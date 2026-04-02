import { MapController } from '@app/controllers/map/map.controller';
import { WaitingRoomController } from '@app/controllers/waiting-room/waiting-room.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionGateway } from '@app/gateways/game-session/game-session.gateway';
import { Map, mapSchema } from '@app/model/database/map';
import { GameSessionService as MatchGameSessionService } from '@app/services/game-session/game-session.service';
import { MapService } from '@app/services/map/map.service';
import { WaitingRoomService as MatchWaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MapGateway } from './gateways/map/map.gateway';
import { PageRoomGateway } from './gateways/page-room/page-room.gateway';
import { MatchWaitingRoomGateway } from './gateways/waiting-room/match-waiting-room.gateway';
import { ChatService } from './services/chat/chat.service';
import { EndStatsService } from './services/end-stats.service';

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
    controllers: [MapController, WaitingRoomController],
    providers: [
        Logger,
        MapGateway,
        PageRoomGateway,
        MapService,
        MatchWaitingRoomGateway,
        MatchGameSessionService,
        MatchWaitingRoomService,
        GameSessionGateway,
        ChatGateway,
        ChatService,
        EndStatsService,
    ],
})
export class AppModule {}
