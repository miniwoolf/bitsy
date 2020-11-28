// todo : what if there are math expressions that don't have two input params?
function MathExpressionEditor(expression, parentEditor, isInline) {
	if (isInline === undefined || isInline === null) {
		isInline = false;
	}

	var self = this;

	var actionEditor = new ActionEditor(this, parentEditor, { isInline: isInline, });

	var div = document.createElement("div");
	div.classList.add("expressionEditor");

	actionEditor.AddContentControl(div);

	// TODO : refactor..
	// var editExpressionButton = document.createElement("button");
	// editExpressionButton.title = "edit expression"; // TODO : localize
	// editExpressionButton.appendChild(iconUtils.CreateIcon("expression_edit"));
	// editExpressionButton.onclick = function() {
	// 	parentEditor.OpenExpressionBuilder(
	// 		expressionRootNode.Serialize(),
	// 		function(expressionNode) {
	// 			expressionRootNode = expressionNode;
	// 			if (node.type === "code_block" &&
	// 				(node.children[0].type === "operator" ||
	// 					node.children[0].type === "literal" ||
	// 					node.children[0].type === "symbol")) {
	// 				node.children[0] = expressionRootNode;
	// 			}
	// 			else {
	// 				node = expressionRootNode;
	// 			}
	// 			CreateExpressionControls(true);
	// 			parentEditor.NotifyUpdate();
	// 		});
	// };

	if (!isInline) {
		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		titleDiv.innerText = "math"; // TODO : is this right? localize
		div.appendChild(titleDiv);
	}

	var editParameterTypes = false;

	var expressionSpan = document.createElement("span");
	expressionSpan.classList.add("actionDescription");
	div.appendChild(expressionSpan);

	// todo : I don't need to recreate these all the time anymore!
	function CreateExpressionControls(isEditable) {
		actionEditor.ClearCommands();

		expressionSpan.innerHTML = "";

		AddOperatorControlRecursive(expression, isEditable);

		// TODO:
		// if (isInline && isEditable) {
		// 	var editExpressionButtonSpan = document.createElement("span");
		// 	editExpressionButtonSpan.classList.add("inlineEditButtonHolder");
		// 	editExpressionButtonSpan.appendChild(editExpressionButton);
		// 	expressionSpan.appendChild(editExpressionButtonSpan);
		// }

		if (isEditable) {
			actionEditor.AddCommand("settings", "edit input types", function() {
				editParameterTypes = !editParameterTypes;
				CreateExpressionControls(true);
			});

			// todo : add command to open the math editor
		}
	}

	function AddOperatorControlRecursive(expression, isEditable) {
		// left expression
		if (expression.list[1].type === "list" && library.IsMathExpression(expression.list[1].list[0].value)) {
			var parenSpanL = document.createElement("span");
			parenSpanL.innerText = "(";
			expressionSpan.appendChild(parenSpanL);

			AddOperatorControlRecursive(expression.list[1], isEditable);

			var parenSpanR = document.createElement("span");
			parenSpanR.innerText = ")";
			expressionSpan.appendChild(parenSpanR);
		}
		else {			
			var leftValueEditor = new ExpressionTypePicker(
				expression.list[1],
				self, // todo -- should be parent editor instead?
				["number", "string", "boolean", "symbol", "list"],
				{
					// todo : do I need this handler?
					openExpressionBuilderFunc : function(expressionString, onAcceptHandler) {
						parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
					},
				});

			if (isEditable) {
				leftValueEditor.Select();
				leftValueEditor.SetTypeEditable(editParameterTypes);
			}

			expressionSpan.appendChild(leftValueEditor.GetElement());
		}

		// operator
		var operatorEditor = new ExpressionOperatorEditor(expression, self, isEditable);
		expressionSpan.appendChild(operatorEditor.GetElement());

		// right expression
		if (expression.list[2].type === "list" && library.IsMathExpression(expression.list[2].list[0].value)) {
			var parenSpanL = document.createElement("span");
			parenSpanL.innerText = "(";
			expressionSpan.appendChild(parenSpanL);

			AddOperatorControlRecursive(expression.list[2], isEditable);

			var parenSpanR = document.createElement("span");
			parenSpanR.innerText = ")";
			expressionSpan.appendChild(parenSpanR);
		}
		else {
			var rightValueEditor = new ExpressionTypePicker(
				expression.list[2],
				self, // todo -- should be parent editor instead?
				["number", "string", "boolean", "symbol", "list"],
				{
					openExpressionBuilderFunc : function(expressionString, onAcceptHandler) {
						parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
					},
				});

			if (isEditable) {
				rightValueEditor.Select();
				rightValueEditor.SetTypeEditable(editParameterTypes);
			}

			expressionSpan.appendChild(rightValueEditor.GetElement());
		}
	}

	CreateExpressionControls(false);

	this.GetElement = function() {
		return actionEditor.GetElement();
	}

	AddSelectionBehavior(
		this,
		function() { CreateExpressionControls(true); },
		function() { CreateExpressionControls(false); },
		isInline);

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
	}
}

// hacky to duplicate these here!
var comparisonOperators = {
	"IS" : "==",
	"ISNT" : "!=",
	"GTE" : ">=",
	"LTE" : "<=",
	"GT" : ">",
	"LT" : "<",
};

var mathOperators = {
	"SUB" : "-",
	"ADD" : "+",
	"DIV" : "/",
	"MLT" : "*",
};

// todo : rename MathOperatorEditor
function ExpressionOperatorEditor(expression, parentEditor, isEditable) {
	var operatorSpan = document.createElement("span");

	function CreateOperatorControl(isEditable) {
		operatorSpan.innerHTML = "";

		// use either the comparison operators or the math operators
		var operatorSymbol = expression.list[0].value;
		var operatorMap = operatorSymbol in comparisonOperators ? comparisonOperators : mathOperators;

		if (isEditable) {
			var operatorSelect = document.createElement("select");

			for (var symbol in operatorMap) {
				var operatorOption = document.createElement("option");
				operatorOption.value = symbol;
				operatorOption.innerText = operatorMap[symbol];
				operatorOption.selected = symbol === operatorSymbol;
				operatorSelect.appendChild(operatorOption);
			}

			operatorSelect.onchange = function(event) {
				expression.list[0].value = event.target.value;
				parentEditor.NotifyUpdate();
			}

			operatorSpan.appendChild(operatorSelect);
		}
		else {
			operatorSpan.innerText = operatorMap[operatorSymbol];
		}
	}

	CreateOperatorControl(isEditable);

	this.GetElement = function() {
		return operatorSpan;
	}
}


/* EXPRESSION BUILDER
	TODO : rename to MathBuilder? MathExpressionBuilder?
	TODO :
	- move into its own file?
	- name vs expression editor? kind of confusing
	- add protections against messing up using the assignment operator "="
	- probably general protections against using the buttons wrong would help
*/
function ExpressionBuilder(expressionString, parentEditor, onCancelHandler, onAcceptHandler) {
	var expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

	var div = document.createElement("div");
	div.classList.add("expressionBuilder");

	var expressionDiv = document.createElement("div");
	expressionDiv.classList.add("expressionEditorRoot");
	div.appendChild(expressionDiv);
	var expressionEditor = new MathExpressionEditor(expressionRootNode, parentEditor, true);
	expressionDiv.appendChild(expressionEditor.GetElement());
	var curNumberSpan = document.createElement("span");
	curNumberSpan.classList.add(GetColorClassForParameterType("number"));
	curNumberSpan.style.borderRadius = "2px";
	expressionDiv.appendChild(curNumberSpan);

	var numericInputRoot = document.createElement("div");
	numericInputRoot.classList.add("expressionBuilderInputs");
	div.appendChild(numericInputRoot);

	var curNumberBeforeDecimal = "";
	var curNumberAfterDecimal = "";
	var curNumberHasDecimal = false;
	function CreateNumberInputHandler(number) { // TODO : uppercase function name?
		return function() {
			if (number === ".") {
				curNumberHasDecimal = true;
			}
			else if (curNumberHasDecimal) {
				curNumberAfterDecimal += number;
			}
			else {
				curNumberBeforeDecimal += number;
			}

			var curNumberString = "";
			curNumberString += curNumberBeforeDecimal.length > 0 ? curNumberBeforeDecimal : "0";
			curNumberString += curNumberHasDecimal ? "." : "";
			curNumberString += curNumberHasDecimal ? (curNumberAfterDecimal.length > 0 ? curNumberAfterDecimal : "0") : "";

			curNumberSpan.innerText = curNumberString;
		}
	}

	function TryAddCurrentNumberToExpression() {
		if (curNumberSpan.innerText.length > 0) {
			var expressionString = expressionRootNode.Serialize();
			expressionString += " " + curNumberSpan.innerText;
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);
		}
		// TODO : clear the number?
	}

	var numberRoot = document.createElement("div");
	numberRoot.style.flexGrow = "3";
	numberRoot.style.display = "flex";
	numberRoot.style.flexDirection = "column";
	numberRoot.style.marginRight = "10px";
	numericInputRoot.appendChild(numberRoot);

	var numberInputs = [["7","8","9"],["4","5","6"],["1","2","3"],["0",".","_"]];
	for (var i = 0; i < numberInputs.length; i++) {
		var numberInputRowDiv = document.createElement("div");
		numberInputRowDiv.style.flexGrow = "1";
		numberInputRowDiv.style.display = "flex";
		numberRoot.appendChild(numberInputRowDiv);
		var numberInputRow = numberInputs[i];

		for (var j = 0; j < numberInputRow.length; j++) {
			var button = document.createElement("button");
			button.classList.add(GetColorClassForParameterType("number"));
			button.innerText = numberInputs[i][j];
			button.style.flexGrow = "1";
			button.onclick = CreateNumberInputHandler(numberInputs[i][j]);

			// hack
			if (numberInputs[i][j] === "_") {
				button.disabled = true;
				button.style.background = "white";
				button.style.color = "white";
			}

			numberInputRowDiv.appendChild(button);
		}
	}

	function CreateOperatorInputHandler(operator) {
		return function() {
			TryAddCurrentNumberToExpression();

			var expressionString = expressionRootNode.Serialize();

			if (operator === "=") {
				// you need a variable to use the assignment operator!
				var leftNode = GetLeftmostNode(expressionRootNode);
				if (leftNode.type === "symbol") {
					expressionString = leftNode.Serialize() + " " + operator;
				}
			}
			else {
				expressionString += " " + operator;
			}

			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
	}

	function ResetExpressionDiv() {
			expressionDiv.innerHTML = "";
			var expressionEditor = new MathExpressionEditor(expressionRootNode, parentEditor, true);
			expressionDiv.appendChild(expressionEditor.GetElement());
			curNumberSpan = document.createElement("span");
			curNumberSpan.classList.add(GetColorClassForParameterType("number"));
			curNumberSpan.style.borderRadius = "2px";
			expressionDiv.appendChild(curNumberSpan);

			// reset the number stuff too
			curNumberBeforeDecimal = "";
			curNumberAfterDecimal = "";
			curNumberHasDecimal = false;
	}

	var operatorInputDiv = document.createElement("div");
	operatorInputDiv.style.flexGrow = "1";
	operatorInputDiv.style.display = "flex";
	operatorInputDiv.style.flexDirection = "column";
	numericInputRoot.appendChild(operatorInputDiv);

	var operatorInputs = ["=", "/", "*", "-", "+"];
	for (var i = 0; i < operatorInputs.length; i++) {
		var button = document.createElement("button");
		button.style.flexGrow = "1";
		button.innerText = operatorInputs[i];
		button.onclick = CreateOperatorInputHandler(operatorInputs[i]);

		if (operatorInputs[i] === "=") {
			button.classList.add("goldColor");
		}

		operatorInputDiv.appendChild(button);
	}

	var comparisonInputDiv = document.createElement("div");
	comparisonInputDiv.style.flexGrow = "1";
	comparisonInputDiv.style.display = "flex";
	comparisonInputDiv.style.flexDirection = "column";
	comparisonInputDiv.style.marginRight = "10px";
	numericInputRoot.appendChild(comparisonInputDiv);

	var comparisonInputs = ["==", ">=", "<=", ">", "<"];
	for (var i = 0; i < comparisonInputs.length; i++) {
		var button = document.createElement("button");
		button.style.flexGrow = "1";
		button.innerText = comparisonInputs[i];
		button.onclick = CreateOperatorInputHandler(comparisonInputs[i]);

		comparisonInputDiv.appendChild(button);	
	}

	// back button
	var backInputDiv = document.createElement("div");
	backInputDiv.style.flexGrow = "1";
	backInputDiv.style.display = "flex";
	backInputDiv.style.flexDirection = "column";
	numericInputRoot.appendChild(backInputDiv);

	var backButton = document.createElement("button");
	backButton.appendChild(iconUtils.CreateIcon("backspace"));
	backButton.onclick = function() {
		var expressionString = expressionRootNode.Serialize();
		var rightNode = GetRightmostNode(expressionRootNode);
		var substringToDelete = rightNode.type === "operator" ? " " + rightNode.operator + " " : rightNode.Serialize();
		expressionString = expressionString.slice(0, expressionString.length - substringToDelete.length);
		expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

		ResetExpressionDiv();
	}
	backInputDiv.appendChild(backButton);

	var clearButton = document.createElement("button");
	clearButton.innerText = localization.GetStringOrFallback("expression_builder_all_clear", "AC");
	clearButton.onclick = function() {
		expressionDiv.classList.add("expressionBuilderClearShake");
		setTimeout(function() {
			expressionDiv.classList.remove("expressionBuilderClearShake");
			var expressionString = "";
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);
			ResetExpressionDiv();
		}, 210);
	}
	backInputDiv.appendChild(clearButton);

	// NON NUMERIC INPUTS!

	var nonNumericInputDiv = document.createElement("div");
	// nonNumericInputDiv.style.flexGrow = "1";
	nonNumericInputDiv.style.marginBottom = "15px";
	nonNumericInputDiv.style.display = "flex";
	nonNumericInputDiv.style.flexDirection = "column";
	div.appendChild(nonNumericInputDiv);

	// add variable:
	var selectedVarNode = CreateDefaultExpression("symbol");

	var addVariableDiv = document.createElement("div");
	addVariableDiv.style.display = "flex";
	addVariableDiv.classList.add("addNonNumericControlBox");
	addVariableDiv.classList.add("goldColorBackground");

	// todo : re-implement
	// var variableParameterEditor = new ParameterEditor(
	// 	["symbol"], 
	// 	function() { return selectedVarNode; },
	// 	function(node) { selectedVarNode = node; },
	// 	true,
	// 	false);

	var addVariableButton = document.createElement("button");
	addVariableButton.classList.add(GetColorClassForParameterType("symbol"));
	addVariableButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("variable_label", "symbol");;
	addVariableButton.style.flexGrow = "1";
	addVariableButton.style.marginRight = "5px";
	addVariableButton.onclick = function() {
		var expressionString = expressionRootNode.Serialize();
		expressionString += " " + selectedVarNode.Serialize();
		expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

		ResetExpressionDiv();
	}
	addVariableDiv.appendChild(addVariableButton);

	var variableParameterEl = variableParameterEditor.GetElement();
	variableParameterEl.style.flexGrow = "1";
	addVariableDiv.appendChild(variableParameterEl);

	nonNumericInputDiv.appendChild(addVariableDiv);

	// add item:
	var selectedItemNode = CreateDefaultExpression("item");

	var addItemDiv = document.createElement("div");
	addItemDiv.style.display = "flex";
	addItemDiv.classList.add("addNonNumericControlBox");
	addItemDiv.classList.add("greenColorBackground");

	// todo : reimplement
	// var itemParameterEditor = new ParameterEditor(
	// 	["item"], 
	// 	function() { return selectedItemNode; },
	// 	function(node) { selectedItemNode = node; },
	// 	true,
	// 	false);

	var addItemButton = document.createElement("button");
	addItemButton.classList.add(GetColorClassForParameterType("item"));
	addItemButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("item_label", "item");
	addItemButton.style.flexGrow = "1";
	addItemButton.style.marginRight = "5px";
	addItemButton.onclick = function() {
		var expressionString = expressionRootNode.Serialize();
		expressionString += " " + "{item " + selectedItemNode.Serialize() + "}";
		expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

		ResetExpressionDiv();
	}
	addItemDiv.appendChild(addItemButton);

	var itemParameterEl = itemParameterEditor.GetElement();
	itemParameterEl.style.flexGrow = "1";
	addItemDiv.appendChild(itemParameterEl);

	nonNumericInputDiv.appendChild(addItemDiv);

	// add text:
	var selectedTextNode = CreateDefaultExpression("string");

	var addTextDiv = document.createElement("div");
	addTextDiv.style.display = "flex";
	addTextDiv.classList.add("addNonNumericControlBox");
	addTextDiv.classList.add("greenColorBackground");

	// todo : reimplement
	// var textParameterEditor = new ParameterEditor(
	// 	["string"], 
	// 	function() { return selectedTextNode; },
	// 	function(node) { selectedTextNode = node; },
	// 	true,
	// 	false);

	var addTextButton = document.createElement("button");
	addTextButton.classList.add(GetColorClassForParameterType("string"));
	addTextButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("value_type_text", "string");
	addTextButton.style.flexGrow = "1";
	addTextButton.style.marginRight = "5px";
	addTextButton.onclick = function() {
		var expressionString = expressionRootNode.Serialize();
		expressionString += " " + selectedTextNode.Serialize();
		expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

		ResetExpressionDiv();
	}
	addTextDiv.appendChild(addTextButton);

	var textParameterEl = textParameterEditor.GetElement();
	textParameterEl.style.flexGrow = "1";
	addTextDiv.appendChild(textParameterEl);

	nonNumericInputDiv.appendChild(addTextDiv);

	// bool buttons
	function CreateBoolInputHandler(bool) {
		return function() {
			var expressionString = expressionRootNode.Serialize();
			expressionString += " " + bool;
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
	}

	var boolInputDiv = document.createElement("div");
	boolInputDiv.style.display = "flex";
	nonNumericInputDiv.appendChild(boolInputDiv);

	var boolInputs = ["YES", "NO"];
	for (var i = 0; i < boolInputs.length; i++) {
		var button = document.createElement("button");
		button.classList.add(GetColorClassForParameterType("boolean"));
		button.style.flexGrow = "1";
		button.innerText = boolInputs[i];
		button.onclick = CreateBoolInputHandler(boolInputs[i]);

		boolInputDiv.appendChild(button);
	}

	// controls for finishing building the expression
	var finishControlsRoot = document.createElement("div");
	finishControlsRoot.style.display = "flex";
	div.appendChild(finishControlsRoot);

	var leftSideSpaceSpan = document.createElement("span");
	leftSideSpaceSpan.style.flexGrow = "3";
	finishControlsRoot.appendChild(leftSideSpaceSpan);

	var cancelButton = document.createElement("button");
	cancelButton.style.flexGrow = "1";
	cancelButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
		+ localization.GetStringOrFallback("action_cancel", "cancel");
	cancelButton.onclick = function() {
		div.classList.add("expressionBuilderCancel");
		setTimeout(onCancelHandler, 250);
	};
	finishControlsRoot.appendChild(cancelButton);

	var acceptButton = document.createElement("button");
	acceptButton.style.flexGrow = "2";
	acceptButton.innerHTML = iconUtils.CreateIcon("checkmark").outerHTML + " "
		+ localization.GetStringOrFallback("action_save", "save");
	acceptButton.classList.add("reverseColors");
	acceptButton.onclick = function() {
		acceptButton.classList.add("expressionBuilderSaveFlash");
		div.classList.add("expressionBuilderSave");
		setTimeout(function() {
			TryAddCurrentNumberToExpression();
			onAcceptHandler(expressionRootNode);
		}, 750);
	}
	finishControlsRoot.appendChild(acceptButton);

	this.GetElement = function() {
		return div;
	}

	function GetRightmostNode(node) {
		if (node.type === "operator") {
			if (node.right === undefined || node.right === null ||
				(node.right.type === "literal" && node.right.value === null)) {
				return node;
			}
			else {
				return GetRightmostNode(node.right);
			}
		}
		else {
			return node;
		}
	}

	function GetLeftmostNode(node) {
		if (node.type === "operator") {
			if (node.left === undefined || node.left === null ||
				(node.left.type === "literal" && node.left.value === null)) {
				return node;
			}
			else {
				return GetLeftmostNode(node.left);
			}
		}
		else {
			return node;
		}
	}
}