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

	// todo : validate that input is correct?
	for (var i = 1; i < expression.list.length; i += 2) {
		var entryEditor = new TableEntryEditor(expression.list[i], expression.list[i + 1], this);
		div.appendChild(entryEditor.GetElement());
	}

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(this);
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

	// todo : replace with parametereditor?
	var valueEditor = createExpressionEditor(valueExpression, this, true);
	div.appendChild(valueEditor.GetElement());

	this.GetElement = function() {
		return div;
	}
}