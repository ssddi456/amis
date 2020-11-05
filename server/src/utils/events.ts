import * as event from 'events';

export default new event.EventEmitter();

export enum EventTypes {
    fileChange = 'filechange',
}