import { EditorMapDb, EditorMapDocument } from '@app/model/database/editor-map';
import { EditorMap } from '@common/interface';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class EditorService {
    constructor(@InjectModel(EditorMapDb.name) private editorMapModel: Model<EditorMapDocument>) {}

    /**
     * Queries the MongoDB to return the EditorMap with the given mapId
     * @param mapId 
     * @returns an
     */
    async getMap(mapId: string): Promise<EditorMap | null> {
        return await this.editorMapModel.findOne({ _id: mapId }); // Error handled by controller
    }
}
