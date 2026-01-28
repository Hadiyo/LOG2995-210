import { CourseController } from '@app/controllers/course/course.controller';
import { DateController } from '@app/controllers/date/date.controller';
import { ExampleController } from '@app/controllers/example/example.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { Course, courseSchema } from '@app/model/database/course';
import { CourseService } from '@app/services/course/course.service';
import { DateService } from '@app/services/date/date.service';
import { ExampleService } from '@app/services/example/example.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EditorController } from './controllers/editor/editor.controller';
import { EditorMap, editorMapSchema } from './model/database/editor-map';
import { EditorService } from './services/editor/editor.service';

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
        MongooseModule.forFeature([{ name: Course.name, schema: courseSchema }, { name: EditorMap.name, schema: editorMapSchema }]),
    ],
    controllers: [CourseController, DateController, ExampleController, EditorController],
    providers: [ChatGateway, CourseService, DateService, ExampleService, Logger, EditorService],
})
export class AppModule {}
