import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';

type CartLine = {
  menuItem: {
    id: string;
    nameEn: string;
    descriptionEn?: string;
    price: number;
    category?: string;
    image?: string;
    isVeg?: boolean;
    rating?: number;
  };
  quantity: number;
};

type AuthUser = { userId: string; role: Role | string; phone?: string };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly streams = new Map<string, Subject<Record<string, unknown>>>();

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(user: AuthUser, body: { items: CartLine[]; deliveryType?: string; deliveryTarget: string; cookingInstructions?: string; paymentMethod?: string }) {
    if (!Array.isArray(body.items) || body.items.length === 0 || !body.deliveryTarget?.trim()) {
      throw new BadRequestException('A delivery target and at least one menu item are required.');
    }

    const menuItems = await Promise.all(body.items.map(async ({ menuItem, quantity }) => {
      if (!menuItem?.id || !menuItem.nameEn || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new BadRequestException('One or more order items are invalid.');
      }
      return this.prisma.menuItem.upsert({
        where: { id: menuItem.id },
        update: {},
        create: {
          id: menuItem.id,
          name: menuItem.nameEn,
          description: menuItem.descriptionEn || menuItem.nameEn,
          price: menuItem.price,
          category: menuItem.category || 'Menu',
          image: menuItem.image || '',
          isVeg: menuItem.isVeg ?? true,
          rating: menuItem.rating ?? 4.8,
        },
      });
    }));

    const totalAmount = menuItems.reduce((total, item, index) => total + item.price * body.items[index].quantity, 0);
    const order = await this.prisma.order.create({
      data: {
        userId: user.userId,
        totalAmount,
        deliveryType: body.deliveryType || 'turf_slot',
        deliveryTarget: body.deliveryTarget.trim(),
        cookingInstructions: body.cookingInstructions?.trim() || null,
        paymentMethod: body.paymentMethod || 'upi',
        items: {
          create: menuItems.map((menuItem, index) => ({
            menuItemId: menuItem.id,
            quantity: body.items[index].quantity,
            price: menuItem.price,
          })),
        },
      },
      include: { items: { include: { menuItem: true } }, driverLocation: true },
    });

    this.emit(order.id, this.toTrackingPayload(order));
    return this.serialize(order);
  }

  async listOrders(user: AuthUser) {
    const where = user.role === 'customer' ? { userId: user.userId } : {};
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { menuItem: true } }, driverLocation: true },
    });
    return orders.map((order) => this.serialize(order));
  }

  async getOrder(user: AuthUser, id: string) {
    const order = await this.getOrderRecord(id);
    if (user.role === 'customer' && order.userId !== user.userId) throw new ForbiddenException('You cannot access this order.');
    return this.serialize(order);
  }

  async updateStatus(user: AuthUser, id: string, status: OrderStatus) {
    if (!['kitchen_staff', 'admin', 'delivery_partner'].includes(user.role)) {
      throw new ForbiddenException('Only staff can update order status.');
    }
    const order = await this.getOrderRecord(id);
    this.assertTransition(order.status, status, user.role);
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { menuItem: true } }, driverLocation: true },
    });
    this.emit(id, this.toTrackingPayload(updated));
    return this.serialize(updated);
  }

  async updateDriverLocation(user: AuthUser, id: string, location: { latitude: number; longitude: number; heading?: number }) {
    if (user.role !== 'delivery_partner') throw new ForbiddenException('Only an authenticated delivery partner can publish live location.');
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
      throw new BadRequestException('A valid latitude and longitude are required.');
    }

    const order = await this.getOrderRecord(id);
    if (order.status !== 'out_for_delivery') throw new BadRequestException('Location sharing begins once the order is out for delivery.');
    const driver = await this.prisma.user.findUnique({ where: { id: user.userId } });
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        driverName: driver?.name || 'IPL Dhaba Delivery Partner',
        driverPhone: driver?.phone || null,
        driverLocation: { upsert: { create: location, update: location } },
      },
      include: { items: { include: { menuItem: true } }, driverLocation: true },
    });
    this.emit(id, this.toTrackingPayload(updated));
    return this.serialize(updated);
  }

  trackingStream(user: AuthUser, id: string): Observable<Record<string, unknown>> {
    return new Observable((subscriber) => {
      this.getOrder(user, id)
        .then((order) => subscriber.next({ event: 'order-update', ...order }))
        .catch((error) => subscriber.error(error));
      const stream = this.getStream(id);
      const subscription = stream.subscribe((event) => subscriber.next(event));
      return () => subscription.unsubscribe();
    });
  }

  private async getOrderRecord(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { menuItem: true } }, driverLocation: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  private assertTransition(current: OrderStatus, next: OrderStatus, role: string) {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      placed: ['preparing', 'cancelled'],
      preparing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (!allowed[current].includes(next)) throw new BadRequestException(`Order cannot move from ${current} to ${next}.`);
    if (role === 'delivery_partner' && !['out_for_delivery', 'delivered'].includes(current)) {
      throw new ForbiddenException('Delivery partners can only complete assigned deliveries.');
    }
  }

  private getStream(id: string) {
    if (!this.streams.has(id)) this.streams.set(id, new Subject<Record<string, unknown>>());
    return this.streams.get(id)!;
  }

  private emit(id: string, payload: Record<string, unknown>) {
    this.getStream(id).next(payload);
  }

  private serialize(order: any) {
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      deliveryType: order.deliveryType,
      deliveryTarget: order.deliveryTarget,
      cookingInstructions: order.cookingInstructions,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt.toISOString(),
      driverName: order.driverName,
      driverPhone: order.driverPhone,
      location: order.driverLocation ? { latitude: order.driverLocation.latitude, longitude: order.driverLocation.longitude, heading: order.driverLocation.heading, updatedAt: order.driverLocation.updatedAt.toISOString() } : null,
      items: order.items.map((item: any) => ({
        quantity: item.quantity,
        menuItem: {
          id: item.menuItem.id,
          nameEn: item.menuItem.name,
          descriptionEn: item.menuItem.description,
          price: item.price,
          category: item.menuItem.category,
          image: item.menuItem.image,
          isVeg: item.menuItem.isVeg,
          rating: item.menuItem.rating,
          prepTimeMinutes: 15,
          nameHi: item.menuItem.name,
          descriptionHi: item.menuItem.description,
        },
      })),
    };
  }

  private toTrackingPayload(order: any) {
    const data = this.serialize(order);
    return { event: 'order-update', ...data };
  }
}
