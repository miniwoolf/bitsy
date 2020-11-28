function FunctionDefinitionEditor(expression, parentEditor, isInline) {
	var actionEditor = new ActionEditor(this, parentEditor, { isInlineBlock: isInline, });

	var div = document.createElement("div");

	actionEditor.AddContentControl(div);

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	titleDiv.innerText = "define function"; // todo : localize
	div.appendChild(titleDiv);

	var mainDiv = document.createElement("div");
	mainDiv.style.padding = "5px"; // hack
	div.appendChild(mainDiv);

	var inputEditor = new FunctionInputEditor(expression.list[1], this);
	mainDiv.appendChild(inputEditor.GetElement());

	var blockEditor = new BlockEditor(expression.list.slice(2), this, false);
	mainDiv.appendChild(blockEditor.GetElement());

	this.GetElement = function() {
		return actionEditor.GetElement();
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
	span.classList.add("functionInputEditor");

	var inputDescription = document.createElement("span");
	inputDescription.classList.add("functionInputDescription");
	span.appendChild(inputDescription);

	var inputList = document.createElement("span");
	inputList.classList.add("functionInputList");
	span.appendChild(inputList);

	var inputEditorRoot = document.createElement("span");
	inputEditorRoot.style.marginRight = "5px"; // hack
	inputList.appendChild(inputEditorRoot);

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
		inputDescription.style.display = inputEditors.length > 0 ? "flex" : "inline-flex";
		thatDoesSpan.style.display = inputEditors.length > 0 ? "flex" : "inline-flex";
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
	inputList.appendChild(addInputButton);

	var removeInputButton = document.createElement("button");
	removeInputButton.title = "remove input parameter"; // todo : localize
	removeInputButton.style.marginRight = "5px";
	removeInputButton.style.display = "none";
	removeInputButton.appendChild(iconUtils.CreateIcon("delete")); // todo : different icon?
	removeInputButton.onclick = function() {
		expression.list = expression.list.slice(0, expression.list.length - 1);
		inputEditors = inputEditors.slice(0, inputEditors.length - 1);
		updateInputEditorList();
		parentEditor.NotifyUpdate();
	}
	inputList.appendChild(removeInputButton);

	var thatDoesSpan = document.createElement("span");
	thatDoesSpan.classList.add("functionInputDescription");
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