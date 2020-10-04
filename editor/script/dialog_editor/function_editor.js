function FunctionDefinitionEditor(expression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("actionEditor");

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	titleDiv.innerText = "define function"; // todo : localize
	div.appendChild(titleDiv);

	var inputDescription = document.createElement("div");
	inputDescription.innerText = "a function with input:";
	div.appendChild(inputDescription);

	var inputEditor = new FunctionInputEditor(expression.list[1], this);
	div.appendChild(inputEditor.GetElement());

	var blockDescription = document.createElement("div");
	blockDescription.innerText = "that does:"
	div.appendChild(blockDescription);

	var blockEditor = new BlockEditor(expression.list.slice(2), this, false);
	div.appendChild(blockEditor.GetElement());

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(this);
}

// todo : name: input vs parameter?
// todo : validate that it's symbols only?
// todo : add new parameter definitions
function FunctionInputEditor(expression, parentEditor) {
	var div = document.createElement("div");

	var inputSeperator = "";

	for (var i = 0; i < expression.list.length; i++) {
		var spaceSpan = document.createElement("span");
		spaceSpan.innerText = inputSeperator;
		div.appendChild(spaceSpan);

		var parameterDefEditor = createExpressionEditor(expression.list[i], this, true);
		div.appendChild(parameterDefEditor.GetElement());

		inputSeperator = ", ";
	}

	this.GetElement = function() {
		return div;
	}
}