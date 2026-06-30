import { EventEmitter } from 'events';

// In Next.js development, global variables are preserved across hot-reloads.
// This ensures we don't create multiple event emitters when files are recompiled.
const globalForEventBus = global as unknown as { eventBus: EventEmitter };

export const eventBus = globalForEventBus.eventBus || new EventEmitter();

// Increase max listeners since each active client (display, doctors) will add a listener
eventBus.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  globalForEventBus.eventBus = eventBus;
}
