function BoxEditor(expression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("actionEditor");

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	titleDiv.innerText = "box"; // todo : localize
	div.appendChild(titleDiv);

	var inputDescription = document.createElement("div");
	inputDescription.innerText = "create box containing:";
	div.appendChild(inputDescription);

	// todo : validate that input is correct?
	for (var i = 1; i < expression.list.length; i += 2) {
		var slotEditor = new BoxSlotEditor(expression.list[i], expression.list[i + 1], this);
		div.appendChild(slotEditor.GetElement());
	}

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(this);	
}

// todo : name?
// todo : needs style so it's ok to have inline math expressions inside these
function BoxSlotEditor(nameExpression, valueExpression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("boxSlotEditor");

	var nameEditor = createExpressionEditor(nameExpression, this, true, "slot");
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