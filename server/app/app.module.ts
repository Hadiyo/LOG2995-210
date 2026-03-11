import { MapController } from '@app/controllers/map/map.controller';
import { Map, mapSchema } from '@app/model/database/map';
import { MapService } from '@app/services/map/map.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameMapController } from './controllers/game-map/game-map.controller';
import { MapGateway } from './gateways/map/map.gateway';
import { PageRoomGateway } from './gateways/page-room/page-room.gateway';
import { SessionGateway } from './gateways/session/session.gateway';
import { WaitingRoomGateway } from './gateways/waiting-room/waiting-room.gateway';
import { GameMapService } from './services/game-map/game-map.service';
import { PlayerService } from './services/player/player.service';
import { GameSessionService } from './services/session/game-session.service';

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
    controllers: [MapController, GameMapController],
    providers: [
        Logger,
        MapGateway,
        SessionGateway,
        PageRoomGateway,
        MapService,
        GameSessionService,
        PlayerService,
        GameMapService,
        WaitingRoomGateway],
})
export class AppModule {}
