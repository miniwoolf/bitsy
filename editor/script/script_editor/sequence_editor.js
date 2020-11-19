var sequenceTypeDescriptionMap = {
	"SEQ" : {
		GetName : function() {
			return localization.GetStringOrFallback("sequence_list_name", "sequence list");
		},
		GetTypeName : function() {
			return localization.GetStringOrFallback("sequence_name", "sequence");
		},
		GetDescription : function() {
			return localization.GetStringOrFallback("sequence_list_description", "go through each item once in _:");
		},
	},
	"CYC" : {
		GetName : function() {
			return localization.GetStringOrFallback("cycle_list_name", "cycle list");
		},
		GetTypeName : function() {
			return localization.GetStringOrFallback("cycle_name", "cycle");
		},
		GetDescription : function() {
			return localization.GetStringOrFallback("cycle_list_description", "repeat items in a _:");
		},
	},
	"SHF" : {
		GetName : function() {
			return localization.GetStringOrFallback("shuffle_list_name", "shuffle list");
		},
		GetTypeName : function() {
			return localization.GetStringOrFallback("shuffle_name", "shuffle");
		},
		GetDescription : function() {
			return localization.GetStringOrFallback("shuffle_list_description", "_ items in a random order:");
		},
	},
};

function SequenceEditor(sequenceExpression, parentEditor) {
	var self = this;

	var div = document.createElement("div");
	div.classList.add("sequenceEditor");
	div.classList.add("actionEditor");

	var sequenceType = sequenceExpression.list[0].value;

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	var titleDiv = document.createElement("div");
	titleDiv.classList.add("actionTitle");
	div.appendChild(titleDiv);

	var descriptionDiv = document.createElement("div");
	descriptionDiv.classList.add("sequenceDescription");
	div.appendChild(descriptionDiv);

	function CreateSequenceDescription(isEditable) {
		descriptionDiv.innerHTML = "";

		titleDiv.innerText = sequenceTypeDescriptionMap[sequenceType].GetName();

		var descriptionText = sequenceTypeDescriptionMap[sequenceType].GetDescription();
		var descriptionTextSplit = descriptionText.split("_");

		var descSpan1 = document.createElement("span");
		descSpan1.innerText = descriptionTextSplit[0];
		descriptionDiv.appendChild(descSpan1);

		if (isEditable) {
			var sequenceTypeSelect = document.createElement("select");
			for (var type in sequenceTypeDescriptionMap) {
				var typeName = sequenceTypeDescriptionMap[type].GetTypeName();
				var sequenceTypeOption = document.createElement("option");
				sequenceTypeOption.value = type;
				sequenceTypeOption.innerText = typeName;
				sequenceTypeOption.selected = (type === sequenceType);
				sequenceTypeSelect.appendChild(sequenceTypeOption);
			}
			sequenceTypeSelect.onchange = function() {
				// todo : reimplement
				// sequenceNode = scriptUtils.ChangeSequenceType(sequenceNode, sequenceTypeSelect.value);
				// node.SetChildren([sequenceNode]);
				// CreateSequenceDescription(true);
				parentEditor.NotifyUpdate();
			}
			descriptionDiv.appendChild(sequenceTypeSelect);
		}
		else {
			var sequenceTypeSpan = document.createElement("span");
			sequenceTypeSpan.classList.add("parameterUneditable");
			sequenceTypeSpan.innerText = sequenceTypeDescriptionMap[sequenceType].GetTypeName();
			descriptionDiv.appendChild(sequenceTypeSpan);
		}

		var descSpan2 = document.createElement("span");
		descSpan2.innerText = descriptionTextSplit[1];
		descriptionDiv.appendChild(descSpan2);
	}

	CreateSequenceDescription(false);

	var optionRootDiv = document.createElement("div");
	optionRootDiv.classList.add("optionRoot");
	div.appendChild(optionRootDiv);

	var addOptionRootDiv = document.createElement("div");
	addOptionRootDiv.classList.add("addOption");
	div.appendChild(addOptionRootDiv);

	var addOptionButton = document.createElement("button");
	addOptionButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("dialog_conditional_add", "add option"); // TODO : funny that this is the old conditional text
	addOptionButton.onclick = function() {
		var token = scriptNext.Parse("{>> ...}", DialogWrapMode.No);
		var optionEditor = new SequenceOptionEditor(token, self);
		optionEditors.push(optionEditor);

		RefreshOptionsUI();
		UpdateNodeOptions();
		parentEditor.NotifyUpdate();
	}
	addOptionRootDiv.appendChild(addOptionButton);

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(
		this,
		function() { CreateSequenceDescription(true); }, /*onSelect*/
		function() { CreateSequenceDescription(false); } /*onDeselect*/ );

	this.GetExpressionList = function() {
		return [sequenceExpression];
	}

	this.NotifyUpdate = function() {
		parentEditor.NotifyUpdate();
	}

	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
	}

	this.RemoveChild = function(childEditor) {
		optionEditors.splice(optionEditors.indexOf(childEditor),1);

		RefreshOptionsUI();
		UpdateNodeOptions();
		parentEditor.NotifyUpdate();
	}

	this.IndexOfChild = function(childEditor) {
		return optionEditors.indexOf(childEditor);
	}

	this.InsertChild = function(childEditor, index) {
		optionEditors.splice(index, 0, childEditor);

		RefreshOptionsUI();
		UpdateNodeOptions();
		parentEditor.NotifyUpdate();
	}

	this.ChildCount = function() {
		return optionEditors.length;
	}

	var optionEditors = [];
	function CreateOptionEditors() {
		optionEditors = [];

		for (var i = 1; i < sequenceExpression.list.length; i++) {
			var optionExpression = sequenceExpression.list[i];
			var optionEditor = new SequenceOptionEditor(optionExpression, self);
			optionEditor.SetOrderNumber(i+1);
			optionRootDiv.appendChild(optionEditor.GetElement());
			optionEditors.push(optionEditor);
		}
	}

	function RefreshOptionsUI() {
		optionRootDiv.innerHTML = "";
		for (var i = 0; i < optionEditors.length; i++) {
			var editor = optionEditors[i];
			editor.SetOrderNumber(i+1);
			optionRootDiv.appendChild(editor.GetElement());
		}
	}

	function UpdateNodeOptions() {
		var updatedOptions = [];

		for (var i = 0; i < optionEditors.length; i++) {
			var editor = optionEditors[i];
			updatedOptions = updatedOptions.concat(editor.GetExpressionList());
		}

		sequenceExpression.list = [sequenceExpression.list[0]].concat(updatedOptions);
	}

	CreateOptionEditors();

	this.OnNodeEnter = function(event) {
		if (event.id === expression.GetId()) {
			div.classList.add("executing");
		}

		for (var i = 0; i < optionEditors.length; i++) {
			if (optionEditors[i].OnNodeEnter) {
				optionEditors[i].OnNodeEnter(event);
			}
		}
	};

	// TODO : some kind of "visit all" functionality like the
	// script node system has would be super helpful...
	// in fact sharing the child - parent relationship code between the two
	// would make sense...
	this.OnNodeExit = function(event) {
		if (event.id === sequenceExpression.GetId() || event.forceClear) {
			div.classList.remove("executing");
			div.classList.remove("executingLeave");
			void div.offsetWidth; // hack to force reflow to allow animation to restart
			div.classList.add("executingLeave");
			setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
		}

		for (var i = 0; i < optionEditors.length; i++) {
			if (optionEditors[i].OnNodeExit) {
				optionEditors[i].OnNodeExit(event);
			}
		}
	};
}

function SequenceOptionEditor(optionExpression, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("optionEditor");

	var topControlsDiv = document.createElement("div");
	topControlsDiv.classList.add("optionControls");
	div.appendChild(topControlsDiv);

	var orderControls = new OrderControls(this, parentEditor);
	topControlsDiv.appendChild(orderControls.GetElement());

	var orderLabel = document.createElement("span");
	orderLabel.innerText = "#)";
	div.appendChild(orderLabel);

	var editor = createExpressionEditor(optionExpression, parentEditor);
	div.appendChild(editor.GetElement());

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [optionExpression];
	}

	this.SetOrderNumber = function(num) {
		var numString = "" + num;
		if (localization.GetLanguage() === "ar") { // arabic
			numString = ConvertNumberStringToArabic(numString);
		}
		orderLabel.innerText = numString + ")";
	}

	// just pass these on
	this.OnNodeEnter = function(event) {
		editor.OnNodeEnter(event);
	}

	this.OnNodeExit = function(event) {
		editor.OnNodeExit(event);
	}

	AddSelectionBehavior(this);
}