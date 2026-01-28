import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false }) // disable _id for embedded docs
export class Vec2 {
    @Prop({ required: true })
    x: number;

    @Prop({ required: true })
    y: number;
}

export const vec2Schema = SchemaFactory.createForClass(Vec2);
