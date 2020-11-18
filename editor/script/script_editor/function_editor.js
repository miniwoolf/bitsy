function FunctionDefinitionEditor(expression, parentEditor, isInline) {
	var div = document.createElement("div");
	div.classList.add("actionEditor");

	if (!isInline) {
		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());
	}

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	titleDiv.innerText = "define function"; // todo : localize
	div.appendChild(titleDiv);

	var inputEditor = new FunctionInputEditor(expression.list[1], this);
	div.appendChild(inputEditor.GetElement());

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

	this.SkipAutoSelect = true;
}

// todo : name: input vs parameter?
// todo : validate that it's symbols only?
// todo : add new parameter definitions
function FunctionInputEditor(expression, parentEditor) {
	var self = this;

	var span = document.createElement("span");

	var inputDescription = document.createElement("span");
	span.appendChild(inputDescription);

	var inputEditorRoot = document.createElement("span");
	span.appendChild(inputEditorRoot);

	var inputEditors = [];

	function createInputEditor(inputExpression, isEditable) {
		var parameterDefEditor = createExpressionEditor(inputExpression, self, true);

		if (isEditable) {
			parameterDefEditor.Select();
		}

		inputEditors.push(parameterDefEditor);
	}

	function updateInputEditorList() {
		// todo : localize
		inputDescription.innerText = inputEditors.length > 0 ? "a function with input: " : "a function ";
		inputDescription.style.display = inputEditors.length > 0 ? "block" : "inline";
		thatDoesSpan.style.display = inputEditors.length > 0 ? "block" : "inline"
		removeInputButton.disabled = inputEditors.length <= 0;

		inputEditorRoot.innerHTML = "";
		var inputSeperator = "";

		for (var i = 0; i < inputEditors.length; i++) {
			var spaceSpan = document.createElement("span");
			spaceSpan.innerText = inputSeperator;
			inputEditorRoot.appendChild(spaceSpan);

			inputEditorRoot.appendChild(inputEditors[i].GetElement());

			inputSeperator = ", ";	
		}
	}

	var addInputButton = document.createElement("button");
	addInputButton.title = "add input parameter"; // todo : localize
	addInputButton.style.display = "none";
	addInputButton.appendChild(iconUtils.CreateIcon("add"));
	addInputButton.onclick = function() {
		var inputExpression = CreateDefaultExpression("symbol");
		expression.list.push(inputExpression);
		createInputEditor(inputExpression, true);
		updateInputEditorList();
		parentEditor.NotifyUpdate();
	}
	span.appendChild(addInputButton);

	var removeInputButton = document.createElement("button");
	removeInputButton.title = "remove input parameter"; // todo : localize
	removeInputButton.style.display = "none";
	removeInputButton.appendChild(iconUtils.CreateIcon("delete")); // todo : different icon?
	removeInputButton.onclick = function() {
		expression.list = expression.list.slice(0, expression.list.length - 1);
		inputEditors = inputEditors.slice(0, inputEditors.length - 1);
		updateInputEditorList();
		parentEditor.NotifyUpdate();
	}
	span.appendChild(removeInputButton);

	var thatDoesSpan = document.createElement("span");
	thatDoesSpan.innerText = " that does:"; // todo : localize
	span.appendChild(thatDoesSpan);

	this.GetElement = function() {
		return span;
	}

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	this.Select = function() {
		addInputButton.style.display = "inline";
		removeInputButton.style.display = "inline";
		removeInputButton.disabled = inputEditors.length <= 0;

		for (var i = 0; i < inputEditors.length; i++) {
			inputEditors[i].Select();
		}
	}

	this.Deselect = function() {
		addInputButton.style.display = "none";
		removeInputButton.style.display = "none";

		for (var i = 0; i < inputEditors.length; i++) {
			inputEditors[i].Deselect();
		}
	}

	// initialize
	for (var i = 0; i < expression.list.length; i++) {
		createInputEditor(expression.list[i], false);
	}
	updateInputEditorList();
}