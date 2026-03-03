import { MapController } from '@app/controllers/map/map.controller';
import { Map, mapSchema } from '@app/model/database/map';
import { MapService } from '@app/services/map/map.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MapGateway } from './gateways/map/map.gateway';
import { SessionGateway } from './gateways/session/session.gateway';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'), // Loaded from .env
            }),
        }),
        MongooseModule.forFeature([
            { name: Map.name, schema: mapSchema },
        ]),
    ],
    controllers: [MapController],
    providers: [MapService, Logger, MapGateway, SessionGateway],
})
export class AppModule {}
