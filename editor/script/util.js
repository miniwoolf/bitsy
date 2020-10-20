/* UTILS
miscellaneous utility functions for the editor
TODO: encapsulate in an object maybe? or is that overkill?
*/

function clamp(val, min, max) {
	return Math.max(Math.min(val, max), min);
}

// used to be in engine, but is still used by editor
function curPal() {
	return getRoomPal(curRoom);
}

function CreateDefaultName(defaultNamePrefix, objectStore, ignoreNumberIfFirstName) {
	if (ignoreNumberIfFirstName === undefined || ignoreNumberIfFirstName === null) {
		ignoreNumberIfFirstName = false;
	}

	var nameCount = ignoreNumberIfFirstName ? -1 : 0; // hacky :(
	for (id in objectStore) {
		if (objectStore[id].name) {
			if (objectStore[id].name.indexOf(defaultNamePrefix) === 0) {
				var nameCountStr = objectStore[id].name.slice(defaultNamePrefix.length);

				var nameCountInt = 0;
				if (nameCountStr.length > 0) {
					nameCountInt = parseInt(nameCountStr);
				}

				if (!isNaN(nameCountInt) && nameCountInt > nameCount) {
					nameCount = nameCountInt;
				}
			}
		}
	}

	if (ignoreNumberIfFirstName && nameCount < 0) {
		return defaultNamePrefix;
	}

	return defaultNamePrefix + " " + (nameCount + 1);
}