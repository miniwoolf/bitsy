function DialogTextEditor(expressionList, parentEditor) {
	var actionEditor = new ActionEditor(this, parentEditor);

	var div = document.createElement("div");
	div.classList.add("dialogEditor");
	actionEditor.AddContentControl(div);

	function OnDialogTextChange() {
		console.log("TEXT CHANGE!!!");
		// a bit wonky
		var tempDialogExpression = scriptNext.Parse(textArea.value, DialogWrapMode.Yes);
		expressionList = tempDialogExpression.list.slice(1);
		parentEditor.NotifyUpdate(true);
	}

	var textSelectionChangeHandler = createOnTextSelectionChange(OnDialogTextChange);

	var dialogText = scriptNext.SerializeWrapped(expressionList);

	var textHolderDiv = document.createElement("div");
	textHolderDiv.classList.add("dialogBoxContainer");

	var textArea = document.createElement("textarea");
	textArea.spellcheck = false;
	textArea.value = dialogText;

	textArea.onchange = OnDialogTextChange;
	textArea.onkeyup = OnDialogTextChange;
	textArea.onblur = OnDialogTextChange;

	textArea.rows = Math.max(4, dialogText.split("\n").length + 1);

	textArea.addEventListener('click', textSelectionChangeHandler);
	textArea.addEventListener('select', textSelectionChangeHandler);
	textArea.addEventListener('blur', textSelectionChangeHandler);

	textHolderDiv.appendChild(textArea);

	textHolderDiv.onclick = function() {
		textArea.focus(); // hijack focus into the actual textarea
	}

	div.appendChild(textHolderDiv);

	this.GetElement = function() {
		return actionEditor.GetElement();
	}

	AddSelectionBehavior(
		this,
		function() { },
		function() { });

	this.GetExpressionList = function() {
		return expressionList;
	}

	this.OnNodeEnter = function(event) {
		if (event.id != undefined) {
			var enterIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
			if (enterIndex == 0) {
				div.classList.add("executing");
			}
		}
	};

	this.OnNodeExit = function(event) {
		if (event.id != undefined) {
			var exitIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
			if (exitIndex >= expressionList.length-1 || event.forceClear) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
				setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
			}
		}
	};
}


// todo : refactor? remove?
var dialogSel = {
	target : null,
	start : 0,
	end : 0,
	onchange : null
}

function createOnTextSelectionChange(onchange) {
	return function(event) {
		dialogSel.target = event.target;
		dialogSel.start = event.target.selectionStart;
		dialogSel.end = event.target.selectionEnd;
		dialogSel.onchange = onchange;

		var effectButtons = document.getElementsByClassName("dialogEffectButton");
		for(var i = 0; i < effectButtons.length; i++) {
			effectButtons[i].disabled = false;
		}
	}
}

function preventTextDeselect(event) {
	if (dialogSel.target != null) {
		// event.preventDefault();
	}
}

function preventTextDeselectAndClick(event) {
	if (dialogSel.target != null) {
		// event.preventDefault();
		event.target.click();
	}
}

function wrapTextSelection(tagOpen, tagClose) {
	if (dialogSel.target != null) {
		var curText = dialogSel.target.value;
		var selText = curText.slice(dialogSel.start, dialogSel.end);

		var isEffectAlreadyApplied = selText.startsWith(tagOpen) && selText.endsWith(tagClose);

		if (isEffectAlreadyApplied) {
			//remove all instances of effect
			var effectlessText = selText.substring(tagOpen.length, selText.length - tagClose.length);
			var newText = curText.slice(0, dialogSel.start) + effectlessText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectlessText.length);

			if (dialogSel.onchange != null) {
				dialogSel.onchange(dialogSel); // dialogSel needs to mimic the event the onchange would usually receive
			}
		}
		else {
			// add effect
			var effectText = tagOpen + selText + tagClose;
			var newText = curText.slice(0, dialogSel.start) + effectText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectText.length);

			if (dialogSel.onchange != null) {
				dialogSel.onchange(dialogSel); // dialogSel needs to mimic the event the onchange would usually receive
			}
		}
	}
}