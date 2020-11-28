// todo : rename? dialogBlock? dialogExpression? dialogExpressionBlock? dialogList? dialogListBlock?
function BlockEditor(expressionList, parentEditor, isDialogExpression) {
	var self = this;

	var div = document.createElement("div");
	div.classList.add("blockEditor");

	if (isDialogExpression) {
		div.classList.add("dialogExpression");
	}
	else {
		div.classList.add("functionBody");
	}

	var childEditorRootDiv = document.createElement("div");
	div.appendChild(childEditorRootDiv);

	var actionBuilder = new ActionBuilder(this);
	div.appendChild(actionBuilder.GetElement());

	this.GetElement = function() {
		return div;
	}

	this.NotifyUpdate = function(hasNewChildren) {
		if (hasNewChildren) {
			UpdateChildren();
		}

		parentEditor.NotifyUpdate();
	}

	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
	}

	var childEditors = [];
	function CreateChildEditors() {
		// build the editors
		childEditors = [];

		var dialogExpressionList = [];
		function addText() {
			if (dialogExpressionList.length > 0) {
				var editor = new DialogTextEditor(dialogExpressionList, self);
				childEditors.push(editor);

				dialogExpressionList = [];
			}
		}

		for (var i = 0; i < expressionList.length; i++) {
			var expression = expressionList[i];

			var listType = null;
			if (expression.type === "list" && expression.list[0].type === "symbol") {
				listType = expression.list[0].value;
			}

			if (!isDialogExpression) {
				childEditors.push(createExpressionEditor(expression, self));
			}
			else if (expression.type === "list" && !scriptNext.IsInlineFunction(listType)) {
				addText();
				childEditors.push(createExpressionEditor(expression, self));
			}
			else {
				dialogExpressionList.push(expression);
			}
		}

		addText();
	}

	var downArrowSvgSource =
		'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + "\n" +
		'<svg viewBox="0 0 50 30" xmlns="http://www.w3.org/2000/svg" xmlns:xlink= "http://www.w3.org/1999/xlink">' + "\n" +
		'<path d="M0,0 0,10 10,10 10,20 20,20 20,30 30,30 30,20 40,20 40,10 50,10 50,0z" />' + "\n" +
		'</svg>';

	function RefreshChildUI() {
		childEditorRootDiv.innerHTML = "";

		for (var i = 0; i < childEditors.length; i++) {
			// TODO : do I want this?
			// if (i >= childEditors.length - 1 && !isDialogExpression) {
			// 	var outputDescSpan = document.createElement("div");
			// 	outputDescSpan.innerText = "output:"; // TODO : localize
			// 	childEditorRootDiv.appendChild(outputDescSpan);
			// }

			var editor = childEditors[i];
			childEditorRootDiv.appendChild(editor.GetElement());

			if (i < childEditors.length - 1) {
				var arrowHolder = document.createElement("div");
				arrowHolder.classList.add("dialogNextArrow");
				childEditorRootDiv.appendChild(arrowHolder);
				arrowHolder.innerHTML = downArrowSvgSource;
			}
		}
	}

	function UpdateChildren() {
		var updatedChildren = [];

		for (var i = 0; i < childEditors.length; i++) {
			var editor = childEditors[i];
			updatedChildren = updatedChildren.concat(editor.GetExpressionList());
		}

		expressionList = updatedChildren;

		parentEditor.NotifyUpdate();
	}

	this.GetExpressionList = function() {
		return expressionList;
	}

	this.Serialize = function() {
		return scriptNext.SerializeWrapped(expressionList);
	}

	this.RemoveChild = function(childEditor) {
		childEditors.splice(childEditors.indexOf(childEditor), 1);

		RefreshChildUI();
		UpdateChildren();

		parentEditor.NotifyUpdate();
	}

	this.IndexOfChild = function(childEditor) {
		return childEditors.indexOf(childEditor);
	}

	this.InsertChild = function(childEditor, index) {
		childEditors.splice(index, 0, childEditor);

		RefreshChildUI();
		UpdateChildren();

		parentEditor.NotifyUpdate();
	}

	this.AddChild = function(childEditor) {
		self.InsertChild(childEditor, childEditors.length);
	}

	this.ChildCount = function() {
		return childEditors.length;
	}

	this.OnNodeEnter = function(event) {
		for (var i = 0; i < childEditors.length; i++) {
			if (childEditors[i].OnNodeEnter) {
				childEditors[i].OnNodeEnter(event);
			}
		}
	}

	this.OnNodeExit = function(event) {
		for (var i = 0; i < childEditors.length; i++) {
			if (childEditors[i].OnNodeExit) {
				childEditors[i].OnNodeExit(event);
			}
		}
	}

	CreateChildEditors();
	RefreshChildUI();

	// default functions for creating add new dialog
	this.AddDialog = function() {
		var token = scriptNext.Parse("...", DialogWrapMode.No);
		var editor = new DialogTextEditor([token], self);
		self.AddChild(editor);
	};

	this.AddChoice = function() {
		var token = scriptNext.Parse("{PIK {>> yes} {>> nice!} {>> no} {>> darn}}", DialogWrapMode.No);
		var editor = new ChoiceEditor(token, self);
		self.AddChild(editor);
	};

	this.AddSequence = function() {
		var token = scriptNext.Parse("{SEQ {>> a} {>> b} {>> c}}", DialogWrapMode.No);
		var editor = new SequenceEditor(token, self);
		self.AddChild(editor);
	};

	this.AddCycle = function() {
		var token = scriptNext.Parse("{CYC {>> a} {>> b} {>> c}}", DialogWrapMode.No);
		var editor = new SequenceEditor(token, self);
		self.AddChild(editor);
	};

	this.AddShuffle = function() {
		var token = scriptNext.Parse("{SHF {>> a} {>> b} {>> c}}", DialogWrapMode.No);
		var editor = new SequenceEditor(token, self);
		self.AddChild(editor);
	};

	this.AddConditional = function() {
		var token = scriptNext.Parse('{IF {GT {ITM "1"} 0} {>> a} {>> b}}', DialogWrapMode.No);
		var editor = new ConditionalEditor(token, self);
		self.AddChild(editor);
	};

	AddSelectionBehavior(this,
		function() {},
		function() {},
		true);
}

function DialogExpressionEditor(dialogExpression, parentEditor) {
	var div = document.createElement("div");

	this.IsDialogExpression = true; // todo : should I make a more general type getter?

	this.GetElement = function() {
		return div;
	}

	this.GetExpressionList = function() {
		return [dialogExpression];
	}

	this.NotifyUpdate = function() {
		dialogExpression.list = [dialogExpression.list[0]].concat(blockEditor.GetExpressionList());
		parentEditor.NotifyUpdate();
	}

	this.Serialize = function() {
		return scriptNext.Serialize(dialogExpression);
	}

	var blockEditor = new BlockEditor(dialogExpression.list.slice(1), this, true);
	div.appendChild(blockEditor.GetElement());

	AddSelectionBehavior(this,
		function() {},
		function() {},
		true);

	this.AddChild = function(childEditor) {
		blockEditor.AddChild(childEditor);
	}

	this.AddDialog = function() {
		blockEditor.AddDialog();
	};

	this.AddChoice = function() {
		blockEditor.AddChoice();
	};

	this.AddSequence = function() {
		blockEditor.AddSequence();
	};

	this.AddCycle = function() {
		blockEditor.AddCycle();
	};

	this.AddShuffle = function() {
		blockEditor.AddShuffle();
	};

	this.AddConditional = function() {
		blockEditor.AddConditional();
	};
}

// TODO : rename? add new functions, etc
function ActionBuilder(parentEditor) {
	var div = document.createElement("div");
	div.classList.add("actionBuilder");

	var addButton = document.createElement("button");
	addButton.classList.add("actionBuilderAdd");
	addButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("action_add_new", "add");
	addButton.onclick = function() {
		div.classList.add("actionBuilderActive");
		div.classList.add("actionBuilderRoot");
	}
	div.appendChild(addButton);

	var backButton = document.createElement("button");
	backButton.classList.add("actionBuilderButton");
	backButton.classList.add("actionBuilderButton_back");
	backButton.innerHTML = iconUtils.CreateIcon("previous").outerHTML + " "
		+ localization.GetStringOrFallback("action_back", "back");
	backButton.onclick = function() {
		div.classList.add("actionBuilderRoot");
		div.classList.remove(activeCategoryClass);
		activeCategoryClass = null;
	}
	div.appendChild(backButton);

	var activeCategoryClass = null;
	function makeActionCategoryButton(categoryName, text) {
		var actionCategoryButton = document.createElement("button");
		actionCategoryButton.classList.add("actionBuilderButton");
		actionCategoryButton.classList.add("actionBuilderCategory");
		actionCategoryButton.innerHTML = text + iconUtils.CreateIcon("next").outerHTML;
		actionCategoryButton.onclick = function() {
			div.classList.remove("actionBuilderRoot");
			activeCategoryClass = "actionBuilder_" + categoryName;
			div.classList.add(activeCategoryClass);
		}
		return actionCategoryButton;
	}

	div.appendChild(makeActionCategoryButton(
		"dialog",
		localization.GetStringOrFallback("dialog_action_category_dialog", "dialog")));

	div.appendChild(makeActionCategoryButton(
		"room",
		"room actions")); // todo : localize

	div.appendChild(makeActionCategoryButton(
		"sprite",
		"sprite actions")); // todo : localize

	// todo : needs its own category?
	// div.appendChild(makeActionCategoryButton(
	// 	"entry",
	// 	"sprite entries")); // todo : localize // todo : is the right name?

	div.appendChild(makeActionCategoryButton(
		"item",
		localization.GetStringOrFallback("dialog_action_category_item", "item and variable actions")));

	div.appendChild(makeActionCategoryButton(
		"advanced",
		"advanced")); // todo : localize

	function makeActionBuilderButton(categoryName, text, createEditorFunc) {
		var actionBuilderButton = document.createElement("button");
		actionBuilderButton.classList.add("actionBuilderButton");
		actionBuilderButton.classList.add("actionBuilderButton_" + categoryName);
		actionBuilderButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " " + text;
		actionBuilderButton.onclick = function() {
			var editor = createEditorFunc();
			parentEditor.AddChild(editor);
			div.classList.remove("actionBuilderActive");
			div.classList.remove(activeCategoryClass);
			activeCategoryClass = null;
		}
		return actionBuilderButton;
	}

	// TODO : localize these too! *** START FROM HERE ***
	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("dialog_block_basic", "dialog"),
			function() {
				var token = scriptNext.Parse("...", DialogWrapMode.No);
				var editor = new DialogTextEditor([token], parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			"choice", // todo : localize
			function() {
				var token = scriptNext.Parse("{PIK {>> A} {>> a} {>> B} {>> b}}", DialogWrapMode.No);
				var editor = new ChoiceEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("sequence_name", "sequence"),
			function() {
				var token = scriptNext.Parse("{SEQ {>> a} {>> b} {>> c}}", DialogWrapMode.No);
				var editor = new SequenceEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("cycle_name", "cycle"),
			function() {
				var token = scriptNext.Parse("{CYC {>> a} {>> b} {>> c}}", DialogWrapMode.No);
				var editor = new SequenceEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("shuffle_name", "shuffle"),
			function() {
				var token = scriptNext.Parse("{SHF {>> a} {>> b} {>> c}}", DialogWrapMode.No);
				var editor = new SequenceEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("dialog_block_conditional", "conditional"),
			function() {
				var token = scriptNext.Parse('{IF {GT {ITM "4"} 0} {>> a} {>> b}}', DialogWrapMode.No);
				var editor = new ConditionalEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"room",
			localization.GetStringOrFallback("function_exit_name", "exit"),
			function() {
				var token = scriptNext.Parse('{EXT "1" 0 0}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"room",
			localization.GetStringOrFallback("function_end_name", "end"),
			function() {
				var token = scriptNext.Parse('{END}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"room",
			"palette swap",
			function() {
				var token = scriptNext.Parse('{PAL "1"}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"sprite",
			"put new sprite", // todo : localize
			function() {
				var token = scriptNext.Parse('{PUT "2"}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"sprite",
			"get rid of sprite", // todo : localize
			function() {
				var token = scriptNext.Parse('{RID THIS}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"sprite",
			"hop a space", // todo : localize
			function() {
				var token = scriptNext.Parse('{HOP THIS "DWN"}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"sprite",
			"change sprite drawing", // todo : localize
			function() {
				var token = scriptNext.Parse('{: THIS TIL "2"}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"sprite",
			localization.GetStringOrFallback("dialog_action_locked_set", "lock / unlock"),
			function() {
				var token = scriptNext.Parse('{: THIS LOK YES}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_item_set", "set item count"),
			function() {
				var token = scriptNext.Parse('{ITM "3" 10}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_item_increase", "increase item count"),
			function() {
				var token = scriptNext.Parse('{ITM "3" {ADD {ITM "3"} 1}}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_variable_set", "set variable value"),
			function() {
				var token = scriptNext.Parse('{SET A 5}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_variable_change", "change variable value"),
			function() {
				var token = scriptNext.Parse('{SET A {ADD A 1}}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			"make local variable", // todo localize
			function() {
				var token = scriptNext.Parse('{VAR X 5}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"advanced",
			"define function", // todo localize
			function() {
				var token = scriptNext.Parse('{VAR F {FN {X} {MLT X 2}}}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"advanced",
			"make table", // todo localize
			function() {
				var token = scriptNext.Parse('{VAR T {TBL :A 5 :B 10}}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"advanced",
			"evaluate function", // todo localize
			function() {
				var token = scriptNext.Parse('{F X}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"advanced",
			"set table entry", // todo localize
			function() {
				var token = scriptNext.Parse('{: T A 10}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"advanced",
			"say variable value", // todo localize
			function() {
				var token = scriptNext.Parse('{SAY A}', DialogWrapMode.No);
				var editor = new ExpressionEditor(token, parentEditor);
				return editor;
			}));

	var cancelButton = document.createElement("button");
	cancelButton.classList.add("actionBuilderButton");
	cancelButton.classList.add("actionBuilderCancel");
	cancelButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
		+ localization.GetStringOrFallback("action_cancel", "cancel");
	cancelButton.onclick = function() {
		div.classList.remove("actionBuilderActive");
		div.classList.remove("actionBuilderRoot");
		if (activeCategoryClass != null) {
			div.classList.remove(activeCategoryClass);
			activeCategoryClass = null;
		}
	}
	div.appendChild(cancelButton);

	this.GetElement = function() {
		return div;
	}
}