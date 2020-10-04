function LiteralEditor(expression, parentEditor, isInline, valueName, onCreateInput, getDisplayValue) {
	var div = isInline ? document.createElement("span") : document.createElement("div");

	if (!isInline) {
		div.classList.add("actionEditor");
	}

	var orderControls = null;
	if (!isInline) {
		orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());
	}

	if (!isInline) {
		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		titleDiv.innerText = valueName;
		div.appendChild(titleDiv);
	}

	var span = document.createElement("span");
	span.classList.add("parameterEditor");
	div.appendChild(span);

	function CreateValueInput(isEditable) {
		span.innerHTML = "";

		if (isEditable) {
			var input = onCreateInput(); // todo : any params?
			span.appendChild(input);
		}
		else {
			var valueSpan = document.createElement("span");
			valueSpan.classList.add("parameterUneditable");
			valueSpan.classList.add(GetColorClassForParameterType(expression.type));
			valueSpan.innerText = getDisplayValue ? getDisplayValue() : scriptNext.SerializeValue(expression.value, expression.type);
			
			span.appendChild(valueSpan)
		}
	}

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(
		this,
		function() { CreateValueInput(true); },
		function() { CreateValueInput(false); },
		isInline);

	CreateValueInput(false);
}

// todo : how do I want to handle inline stuff now?
function NumberEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"number", // todo : localize
			function() {
				var input = document.createElement("input");
				input.type = "number";
				input.min = 0;
				input.step = "any";
				input.value = expression.value;
				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			}
		));
}

// todo: do I want any of these names to differ from the script type? text or variable for example?
function StringEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"text", // todo : localize
			function() {
				var input = document.createElement("input");
				input.type = "string";
				input.value = expression.value;
				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			}
		));
}

function BooleanEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"boolean", // todo : localize // todo : friendlier name?
			function() {
				var input = document.createElement("select");

				var boolTrueOption = document.createElement("option");
				boolTrueOption.value = "YES";
				boolTrueOption.innerText = "YES"; // TODO : localize
				boolTrueOption.selected = expression.value;
				input.appendChild(boolTrueOption);

				var boolFalseOption = document.createElement("option");
				boolFalseOption.value = "NO";
				boolFalseOption.innerText = "NO"; // TODO : localize
				boolFalseOption.selected = !expression.value;
				input.appendChild(boolFalseOption);

				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			}
		));
}

function SymbolEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"symbol", // todo : localize // todo : name variable instead??
			function() {
				var input = document.createElement("span");

				var variableInput = document.createElement("input");
				variableInput.type = "string";
				variableInput.setAttribute("list", "variable_datalist");
				variableInput.value = expression.value;
				input.appendChild(variableInput);
				
				// todo : make this more robust?
				var variableDatalist = document.createElement("datalist");
				variableDatalist.id = "variable_datalist"; // will duplicates break this?
				for (var name in variable) {
					var variableOption = document.createElement("option");
					variableOption.value = name;
					variableDatalist.appendChild(variableOption);
				}
				input.appendChild(variableDatalist);

				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			}
		));
}


// todo : put in shared location?
function GetItemNameFromId(id) {
	if (!item[id]) {
		return "";
	}

	return (item[id].name != null ? item[id].name : localization.GetStringOrFallback("item_label", "item") + " " + id);
}

// todo : put in shared location?
function GetRoomNameFromId(id) {
	if (!room[id]) {
		return "";
	}

	return (room[id].name != null ? room[id].name : localization.GetStringOrFallback("room_label", "room") + " " + id);
}

function RoomIdEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"room select", // todo : localize
			function() {
				var input = document.createElement("select");
				input.title = "choose room";

				for (id in room) {
					var roomOption = document.createElement("option");
					roomOption.value = id;
					roomOption.innerText = GetRoomNameFromId(id);
					roomOption.selected = id === expression.value;
					input.appendChild(roomOption);
				}

				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			},
			function() {
				return GetRoomNameFromId(expression.value);
			},
		));
}

// for rendering item thumbnails
var thumbnailRenderer = CreateDrawingThumbnailRenderer();

// todo : reimplement thumbnail rendering
function ItemIdEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"item select", // todo : localize
			function() {
				var input = document.createElement("select");
				input.title = "choose item";

				for (id in item) {
					var itemOption = document.createElement("option");
					itemOption.value = id;
					itemOption.innerText = GetItemNameFromId(id);
					itemOption.selected = id === expression.value;
					input.appendChild(itemOption);
				}

				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			},
			function() {
				return GetItemNameFromId(expression.value);
			},
		));

	// todo : use this somehow
	// // todo : is this the right place for this? shouldn't I put it inside the item id editor?
	// if (curType === "item") {
	// 	var itemId = expression.list[parameterIndex].value;

	// 	// only try to render the item if it actually exists!
	// 	if (item.hasOwnProperty(itemId)) {
	// 		var itemThumbnail = document.createElement("img");
	// 		span.appendChild(itemThumbnail);
	// 		itemThumbnail.id = "param_item_" + itemId;
	// 		itemThumbnail.style.width = "16px";
	// 		itemThumbnail.style.marginLeft = "4px";
	// 		thumbnailRenderer.Render(itemId, function(uri) { itemThumbnail.src = uri; }, { isAnimated: false });
	// 	}
	// }
}

// TODO : put in shared location?
var transitionTypes = [
	{
		GetName: function() { return localization.GetStringOrFallback("transition_fade_w", "fade (white)"); },
		id: "fade_w",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_fade_b", "fade (black)"); },
		id: "fade_b",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_wave", "wave"); },
		id: "wave",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_tunnel", "tunnel"); },
		id: "tunnel",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_u", "slide up"); },
		id: "slide_u",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_d", "slide down"); },
		id: "slide_d",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_l", "slide left"); },
		id: "slide_l",
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_r", "slide right"); },
		id: "slide_r",
	},
];

function TransitionIdEditor(expression, parentEditor, isInline) {
	Object.assign(
		this,
		new LiteralEditor(
			expression,
			parentEditor,
			isInline,
			"transition select", // todo : localize
			function() {
				var input = document.createElement("select");
				input.title = "select transition effect";

				for (var i = 0; i < transitionTypes.length; i++) {
					var id = transitionTypes[i].id;
					var transitionOption = document.createElement("option");
					transitionOption.value = id;
					transitionOption.innerText = transitionTypes[i].GetName();
					transitionOption.selected = id === expression.value;
					input.appendChild(transitionOption);
				}

				input.onchange = function(event) {
					expression.value = event.target.value;
					// todo : notify parent!
				}

				return input;
			},
			function() {
				var name = "";

				// TODO : kind of using the loop in a weird way
				for (var i = 0; i < transitionTypes.length; i++) {
					var id = transitionTypes[i].id;
					if (id === expression.value) {
						name = transitionTypes[i].GetName();
					}
				}

				return name;
			},
		));		
}

// todo : remove? rename?
function CreateDefaultArgNode(type) {
	var argNode;
	if (type === "number") {
		// todo : replace these with helper function from script module?
		argNode = { type: "number", value: 0 };
	}
	else if (type === "string") {
		argNode = { type: "string", value: "" };
	}
	else if (type === "boolean") {
		argNode = { type: "boolean", value: true };
	}
	else if (type === "symbol") {
		argNode = { type: "symbol", value: "a" }; // TODO : find first var instead?
	}
	else if (type === "list") {
		// todo : I recreated the old logic for this but is this still what we want?
		argNode = [{ type: "symbol", value: "item" }, { type: "symbol", value: "0" }];
	}
	else if (type === "room") {
		argNode = { type: "symbol", value: "0" }; // TODO : find first room instead?
	}
	else if (type === "item") {
		argNode = { type: "symbol", value: "0" }; // TODO : find first item instead?
	}
	else if (type === "transition") {
		argNode = { type: "string", value: "fade_w" };
	}
	return argNode;
}

function GetColorClassForParameterType(type) {
	if (type === "number") {
		return "pinkColor";
	}
	else if (type === "string") {
		return "greenColor";
	}
	else if (type === "boolean") {
		return "greenColor";
	}
	else if (type === "symbol") {
		return "goldColor";
	}
}

function ParameterEditor(expression, parameterIndex, parentEditor, parameterTypes, isEditable, isTypeEditable, openExpressionBuilderFunc) {
	var self = this;

	var curType;

	var span = document.createElement("span");

	function UpdateEditor(type) {
		curType = type;

		span.innerHTML = "";

		if (isEditable && isTypeEditable) {
			var typeSelect = document.createElement("select");
			span.appendChild(typeSelect);
			for (var i = 0; i < parameterTypes.length; i++) {
				var typeOption = document.createElement("option");
				typeOption.value = parameterTypes[i];
				typeOption.innerText = parameterTypes[i]; // TODO : localize
				typeOption.selected = curType === parameterTypes[i];
				typeSelect.appendChild(typeOption);
			}

			typeSelect.onchange = function(event) {
				ChangeEditorType(event.target.value);
			}
		}

		var editor = createExpressionEditor(expression.list[parameterIndex], parentEditor, true, curType);

		if (isEditable && editor.Select) {
			editor.Select();
		}

		span.appendChild(editor.GetElement());
	}

	function ChangeEditorType(type) {
		SetArgToDefault(type);
		UpdateEditor(type);
	}

	function SetArgToDefault(type) {
		expression.list[parameterIndex] = CreateDefaultArgNode(type);
	}

	function DoesEditorTypeMatchExpression(type, exp) {
		if (type === "boolean" && exp.value === null) {
			// todo : keep this catch all for weird cases?
			return true;
		}
		else if (type === "number" && exp.type === "number" && (typeof exp.value) === "number") {
			return true;
		}
		else if (type === "string" && exp.type === "string" && (typeof exp.value) === "string") {
			return true;
		}
		else if (type === "boolean" && exp.type === "boolean" && (typeof exp.value) === "boolean") {
			return true;
		}
		else if (type === "symbol" && exp.type === "symbol") {
			return true;
		}
		else if (type === "room" && exp.type === "string" && (typeof exp.value) === "string" && exp.value in room) {
			return true;
		}
		else if (type === "item" && exp.type === "string" && (typeof exp.value) === "string" && exp.value in item) {
			return true;
		}
		else if (type === "transition" && exp.type === "string" && (typeof exp.value) === "string") {
			return true;
		}
		else if (type === "list" && exp.type === "list") {
			return true;
		}

		return false;
	}

	// edit parameter with the first matching type this parameter supports
	var curType = parameterTypes[0];
	for (var i = 0; i < parameterTypes.length; i++) {
		if (DoesEditorTypeMatchExpression(parameterTypes[i], expression.list[parameterIndex])) {
			curType = parameterTypes[i];
			break;
		}
	}

	UpdateEditor(curType);

	this.GetElement = function() {
		return span;
	}

	this.NotifyUpdate = function() {
		// hack to force an update
		// TODO : re-implement??
	}

	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		if (openExpressionBuilderFunc) {
			openExpressionBuilderFunc(expressionString, onAcceptHandler);
		}
	}
}