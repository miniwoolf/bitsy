function ChoiceEditor(choiceExpression, parentEditor) {
	var self = this;

	var div = document.createElement("div");
	div.classList.add("choiceEditor");
	div.classList.add("actionEditor");

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	div.appendChild(titleDiv);

	var titleIcon = iconUtils.CreateIcon("choice");
	titleIcon.classList.add("icon_space_right");
	titleDiv.appendChild(titleIcon);

	var titleSpan = document.createElement("span");
	titleSpan.innerText = "choice"; // TODO : localize
	titleDiv.appendChild(titleSpan);

	var descriptionDiv = document.createElement("div");
	descriptionDiv.classList.add("sequenceDescription"); // hack
	descriptionDiv.innerText = "let player pick from choices:"; // TODO : localize
	div.appendChild(descriptionDiv);

	var optionRootDiv = document.createElement("div");
	optionRootDiv.classList.add("optionRoot");
	div.appendChild(optionRootDiv);

	this.GetElement = function() {
		return div;
	};

	this.GetExpressionList = function() {
		return [choiceExpression];
	};

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	AddSelectionBehavior(this);

	var optionEditors = [];
	function CreateOptionEditors() {
		optionEditors = [];

		for (var i = 1; i < choiceExpression.list.length; i += 2) {
			var optionExpression = choiceExpression.list[i];
			var resultExpression = choiceExpression.list[i + 1];
			var optionEditor = new ChoiceOptionEditor(optionExpression, resultExpression, self, i - 1);
			optionRootDiv.appendChild(optionEditor.GetElement());
			optionEditors.push(optionEditor);
		}
	}

	CreateOptionEditors();

	// todo : share w/ sequence?
	this.RemoveChild = function(childEditor) {
		optionEditors.splice(optionEditors.indexOf(childEditor), 1);

		RefreshOptionsUI();
		UpdateExpressionList();
		parentEditor.NotifyUpdate();
	}

	this.IndexOfChild = function(childEditor) {
		return optionEditors.indexOf(childEditor);
	}

	this.InsertChild = function(childEditor, index) {
		optionEditors.splice(index, 0, childEditor);

		RefreshOptionsUI();
		UpdateExpressionList();
		parentEditor.NotifyUpdate();
	}

	this.ChildCount = function() {
		return optionEditors.length;
	}

	function RefreshOptionsUI() {
		optionRootDiv.innerHTML = "";
		for (var i = 0; i < optionEditors.length; i++) {
			var editor = optionEditors[i];
			// editor.SetOrderNumber(i + 1);
			optionRootDiv.appendChild(editor.GetElement());
		}
	}

	function UpdateExpressionList() {
		var updatedOptions = [];

		for (var i = 0; i < optionEditors.length; i++) {
			var editor = optionEditors[i];
			updatedOptions = updatedOptions.concat(editor.GetExpressionList());
		}

		choiceExpression.list = [choiceExpression.list[0]].concat(updatedOptions);
	}
}

function ChoiceOptionEditor(choiceExpression, resultExpression, parentEditor, index) {
	var div = document.createElement("div");
	div.classList.add("optionEditor");

	var topControlsDiv = document.createElement("div");
	topControlsDiv.classList.add("optionControls");
	div.appendChild(topControlsDiv);

	var orderControls = new OrderControls(this, parentEditor);
	topControlsDiv.appendChild(orderControls.GetElement());

	var optionLabel = document.createElement("span");
	optionLabel.innerText = "if player picks:"; // todo : localize
	div.appendChild(optionLabel);

	// condition
	var choiceEditor = createExpressionEditor(choiceExpression, this);
	div.appendChild(choiceEditor.GetElement());

	var resultLabel = document.createElement("span");
	resultLabel.innerText = "then:"; // todo : localize
	div.appendChild(resultLabel);

	// result
	var resultEditor = createExpressionEditor(resultExpression, this);
	div.appendChild(resultEditor.GetElement());

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [choiceExpression, resultExpression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	AddSelectionBehavior(this);
}