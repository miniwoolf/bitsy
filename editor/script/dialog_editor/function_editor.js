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

	// todo : what if there is no input params??
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

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function() {
		expression.list = [expression.list[0], expression.list[1]];
		expression.list = expression.list.concat(blockEditor.GetExpressionList());

		parentEditor.NotifyUpdate();
	}

	AddSelectionBehavior(
		this,
		function() {
			inputEditor.Select();	
		},
		function() {
			inputEditor.Deselect();
		});
}

// todo : name: input vs parameter?
// todo : validate that it's symbols only?
// todo : add new parameter definitions
function FunctionInputEditor(expression, parentEditor) {
	var div = document.createElement("div");

	var inputSeperator = "";

	var inputEditors = [];

	for (var i = 0; i < expression.list.length; i++) {
		var spaceSpan = document.createElement("span");
		spaceSpan.innerText = inputSeperator;
		div.appendChild(spaceSpan);

		var parameterDefEditor = createExpressionEditor(expression.list[i], this, true);
		inputEditors.push(parameterDefEditor);
		div.appendChild(parameterDefEditor.GetElement());

		inputSeperator = ", ";
	}

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	this.Select = function() {
		for (var i = 0; i < inputEditors.length; i++) {
			inputEditors[i].Select();
		}
	}

	this.Deselect = function() {
		for (var i = 0; i < inputEditors.length; i++) {
			inputEditors[i].Deselect();
		}
	}
}