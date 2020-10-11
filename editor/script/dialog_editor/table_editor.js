function TableEditor(expression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("actionEditor");

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	titleDiv.innerText = "table"; // todo : localize
	div.appendChild(titleDiv);

	var inputDescription = document.createElement("div");
	inputDescription.innerText = "make table containing entries:";
	div.appendChild(inputDescription);

	var entryEditors = [];

	// todo : validate that input is correct?
	for (var i = 1; i < expression.list.length; i += 2) {
		var editor = new TableEntryEditor(expression.list[i], expression.list[i + 1], this);
		entryEditors.push(editor);
		div.appendChild(editor.GetElement());
	}

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function() {
		expression.list = [expression.list[0]];

		for (var i = 0; i < entryEditors.length; i++) {
			expression.list = expression.list.concat(entryEditors[i].GetExpressionList());
		}

		parentEditor.NotifyUpdate();
	}

	AddSelectionBehavior(
		this,
		function() {
			for (var i = 0; i < entryEditors.length; i++) {
				entryEditors[i].Select();
			}
		},
		function() {
			for (var i = 0; i < entryEditors.length; i++) {
				entryEditors[i].Deselect();
			}
		});
}

// todo : needs style so it's ok to have inline math expressions inside these
function TableEntryEditor(nameExpression, valueExpression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("tableEntryEditor");

	var nameEditor = createExpressionEditor(nameExpression, this, true, "entry");
	div.appendChild(nameEditor.GetElement());

	var seperatorSpan = document.createElement("span");
	seperatorSpan.innerText = " : ";
	div.appendChild(seperatorSpan);

	// todo : add expression builder handler?
	var valueEditor = new ExpressionTypePicker(
		valueExpression,
		this, // or should this be parent editor?
		["number", "text", "boolean", "symbol", "list"]);

	div.appendChild(valueEditor.GetElement());

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [nameExpression, valueExpression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	this.Select = function() {
		nameEditor.Select();
		valueEditor.Select();
		valueEditor.SetTypeEditable(true);
	}

	this.Deselect = function() {
		nameEditor.Deselect();
		valueEditor.Deselect();
	}
}