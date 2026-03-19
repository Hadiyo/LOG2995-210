export enum ServiceState {
    Idle = 'IDLE',           // nothing happening yet
    Loading = 'LOADING',     // request in progress
    Loaded = 'LOADED',       // maps fetched successfully
    Error = 'ERROR',         // failed to fetch
    Created = 'CREATED',
}
