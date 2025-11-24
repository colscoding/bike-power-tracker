/**
 * Get DOM element by ID with null check
 * @param {string} id - Element ID
 * @returns {HTMLElement | null}
 */
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID "${id}" not found in DOM`);
    }
    return element;
}

export const connectPowerElem = getElement('connectPower');
export const connectHeartrateElem = getElement('connectHeartrate');
export const connectCadenceElem = getElement('connectCadence');

export const powerElement = getElement('power');
export const heartrateElement = getElement('heartrate');
export const cadenceElement = getElement('cadence');


export const elements = {
    power: { display: powerElement, connect: connectPowerElem },
    heartrate: { display: heartrateElement, connect: connectHeartrateElem },
    cadence: { display: cadenceElement, connect: connectCadenceElem },
};
