/* 
INVENTORY UI 

TODO
- encapsulate this!!
- refactor to work with
	- variable store that changes at runtime
	- more complex types (TBL, FN)

*/


function updateInventoryUI() {
	// console.log("~~~ UPDATE INVENTORY ~~~");
	updateInventoryItemUI();
	updateInventoryVariableUI();
}

function listenForInventoryItemChanges() {
	// todo : this is kind of heavy handed..
	events.Listen("item_inventory_change", function(e) {
		updateInventoryItemUI();
	});
}

function updateInventoryItemUI(){
	var viewport = document.getElementById("inventoryItem");
	viewport.innerHTML = "";

	function createOnItemValueChange(id) {
		return function(event) {
			var playerEntry = isPlayMode ? player() : tile[getPlayerId()];

			if (playerEntry) {
				if (event.target.value <= 0) {
					delete playerEntry.inventory[id];
				}
				else {
					playerEntry.inventory[id] = parseFloat(event.target.value);
				}

				events.Raise("item_inventory_change", { id: id, count: event.target.value });

				if (!isPlayMode) {
					refreshGameData();
				}
			}
		}
	}

	// console.log("UPDATE!!!!");
	var itemLabel = localization.GetStringOrFallback("item_label", "item");
	for (id in tile) {
		var til = tile[id];

		if (til.type === TYPE_KEY.ITEM) {
			var itemName = til.name != null ? til.name : itemLabel + " " + id;
			var playerEntry = isPlayMode ? player() : tile[getPlayerId()];

			// why is this null?
			if (playerEntry) {
				var itemCount = playerEntry.inventory[id] != undefined ? parseFloat(playerEntry.inventory[id]) : 0;

				var itemDiv = document.createElement("div");
				itemDiv.classList.add("controlBox");
				itemDiv.id = "inventoryItem_" + id;
				itemDiv.title = itemName;
				viewport.appendChild(itemDiv);

				var itemNameSpan = document.createElement("span");
				itemNameSpan.innerText = itemName + " : ";
				itemDiv.appendChild(itemNameSpan);

				var itemValueInput = document.createElement("input");
				itemValueInput.type = "number";
				itemValueInput.min = 0;
				itemValueInput.value = itemCount;
				itemValueInput.style.fontSize = "100%";
				itemValueInput.style.width = "30%";
				itemValueInput.addEventListener('change', createOnItemValueChange(id));
				itemDiv.appendChild(itemValueInput);
			}
		}
	}
}

/*
TODO
- add variables
- delete variables
- make sure variable names are valid
*/
function updateInventoryVariableUI(){
	var viewport = document.getElementById("inventoryVariable");
	viewport.innerHTML = "";

	function createOnVariableValueChange(varInfo) {
		return function(event) {
			console.log("VARIABLE CHANGE " + event.target.value);
			if (isPlayMode) {
				// TODO : rewrite
			}
			else {
				variable[varInfo.id] = event.target.value;
				refreshGameData();
			}
		};
	}

	function createOnVariableNameChange(varInfo,varDiv) {
		return function(event) {
			console.log("VARIABLE NAME CHANGE " + event.target.value);
			if (isPlayMode) {
				var value = ""; // default empty string in case there is no variable yet

				// TODO : rewrite

				varInfo.id = event.target.value;
			}
			else {
				variable[event.target.value] = "" + variable[varInfo.id] + "";
				var oldId = varInfo.id;
				setTimeout(function() {delete variable[oldId]; refreshGameData();}, 0); //hack to avoid some kind of delete race condition? (there has to be a better way)

				varInfo.id = event.target.value;
				varDiv.id = "inventoryVariable_" + varInfo.id;
				varDiv.title = "variable " + varInfo.id;
			}
		}
	}

	function createOnVariableDelete(varInfo) {
		return function () {
			if(isPlayMode) {
				// todo : rewrite
			}
			else {
				delete variable[varInfo.id];
				refreshGameData();
				updateInventoryVariableUI();
			}
		}
	}

	function addVariableRegister(id) {
		var varName = id;
		var varValue = variable[id];

		if(id === null)
		{
			id = "";
			varName = "";
			varValue = "";
		}

		var varInfo = {
			id : id
		};

		var varDiv = document.createElement("div");
		varDiv.classList.add("controlBox");
		varDiv.classList.add("inventoryVariableBox");
		varDiv.id = "inventoryVariable_" + id;
		varDiv.title = "variable " + id;
		viewport.appendChild(varDiv);

		var varNameInput = document.createElement("input");
		varNameInput.type = "text";
		varNameInput.value = varName;
		varNameInput.style.width = "20%";
		varNameInput.addEventListener('change', createOnVariableNameChange(varInfo,varDiv));
		varDiv.appendChild( varNameInput );

		var varSplitSpan = document.createElement("span");
		varSplitSpan.innerText = " : ";
		varDiv.appendChild( varSplitSpan );

		var varValueInput = document.createElement("input");
		varValueInput.type = "text";
		varValueInput.value = varValue;
		varValueInput.style.width = "30%";
		var onVariableValueChange = createOnVariableValueChange(varInfo);
		varValueInput.addEventListener('change', onVariableValueChange);
		varValueInput.addEventListener('keyup', onVariableValueChange);
		varValueInput.addEventListener('keydown', onVariableValueChange);
		varDiv.appendChild( varValueInput );

		var deleteVarEl = document.createElement("button");
		deleteVarEl.appendChild(iconUtils.CreateIcon("delete"));
		deleteVarEl.addEventListener('click', createOnVariableDelete(varInfo));
		deleteVarEl.title = "delete this variable";
		varDiv.appendChild(deleteVarEl);
	}

	// TODO : is this good?
	for (id in variable) {
		addVariableRegister(id);
	}

	function createAddButton() {
		var addVarEl = document.createElement("button");
		addVarEl.title = "add new variable";
		addVarEl.appendChild(iconUtils.CreateIcon("add"));
		var addVarText = document.createElement("span");
		addVarText.innerText = localization.GetStringOrFallback("variable_add", "add variable");
		console.log("CREATE ADD BUTTON " + addVarText.innerText);
		addVarEl.appendChild( addVarText );
		addVarEl.addEventListener('click', function() {
			viewport.removeChild(addVarEl);
			addVariableRegister(null);
			createAddButton();
		});
		viewport.appendChild(addVarEl);
	};
	createAddButton();
}