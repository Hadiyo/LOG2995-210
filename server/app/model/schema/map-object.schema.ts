import { vec2Schema } from '@app/model/schema/vec2.schema';
import { ObjectSize, ObjectType } from '@common/enum';
import { Vec2 } from '@common/interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class MapObject {
    @Prop({ required: true })
    id: number;

    @Prop({ enum: ObjectType, required: true })
    type: ObjectType;

    @Prop({ type: vec2Schema, required: true })
    position: Vec2;

    @Prop({ enum: ObjectSize, required: true })
    size: ObjectSize;
}

export const mapObjectSchema = SchemaFactory.createForClass(MapObject);
