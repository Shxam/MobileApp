import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FirebaseAuthDto {
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  favoriteTeam?: string;
}
