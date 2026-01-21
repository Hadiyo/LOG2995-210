export enum GameMode {
    CLASSIC = 'CLASSIC',
    CTF = 'CTF'
}

export enum MapSize {
    S = '10x10',
    M = '15x15',
    L = '20x20'
}

export enum TileType {
    DIRT = 'DIRT',
    WATER = 'WATER',
    ICE = 'ICE',
    WALL = 'WALL',
    DOOR = 'DOOR',
}

export enum ObjectType {
    START = 'START',
    FLAG = 'FLAG',
    REGEN = 'REGEN',
    ARENA = 'ARENA'
}

export enum ObjectSize {
    S = '1x1',
    L = '2x2'
}

export enum MouseEventType {
    CLICK = "click",
    UP = "mouseUp",
    DOWN = "mouseDown",
    ENTER = "mouseEnter",
    LEAVE = "mouseLeave"
}