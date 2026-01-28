export const TEMP_ERROR_DURATION_5000MS = 5000;
export const TEMP_ERROR_DURATION_8000MS = 8000;

/**
 * Generic function to create a temporary error message from a signal in the DOM with a custom message
 * @param signal 
 * @param message 
 * @param duration 
 */
export function showTemporaryMessage(
    signal: { set: (value: string | null) => void; (): string | null },
    message: string,
    duration = TEMP_ERROR_DURATION_5000MS
) {
    signal.set(message);

    setTimeout(() => {
        // only clear if message hasn't changed
        if (signal() === message) {
            signal.set(null);
        }
    }, duration);
}
