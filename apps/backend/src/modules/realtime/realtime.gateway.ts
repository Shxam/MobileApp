import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: any;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: WebSocket) {
    this.logger.log('Client connected to Realtime Gateway');
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log('Client disconnected from Realtime Gateway');
  }

  broadcast(event: string, payload: any, dhabaId: string = 'dhaba_singarayakonda') {
    if (!this.server || !this.server.clients) return;

    const data = JSON.stringify({ event, dhabaId, payload, timestamp: new Date().toISOString() });

    this.server.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }
}
