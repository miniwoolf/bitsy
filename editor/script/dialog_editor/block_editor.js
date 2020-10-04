// todo : rename? dialogBlock? dialogExpression? dialogExpressionBlock? dialogList? dialogListBlock?
function BlockEditor(dialogList, parentEditor) {
	var self = this;

	var div = document.createElement("div");
	div.classList.add("blockEditor");

	var childEditorRootDiv = document.createElement("div");
	div.appendChild(childEditorRootDiv);

	var actionBuilder = new ActionBuilder(this);
	div.appendChild(actionBuilder.GetElement());

	this.GetElement = function() {
		return div;
	}

	this.NotifyUpdate = function(hasNewChildren) {
		if (hasNewChildren) {
			UpdateNodeChildren();
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

		for (var i = 1; i < dialogList.list.length; i++) {
			var expression = dialogList.list[i];

			var listType = null;
			if (expression.type === "list" && expression.list[0].type === "symbol") {
				listType = expression.list[0].value;
			}

			if (expression.type === "list" && !scriptNext.IsInlineFunction(listType)) {
				addText();
				childEditors.push(createExpressionEditor(expression, self));
			}
			else {
				dialogExpressionList.push(expression);
			}
		}

		addText();
	}

	function RefreshChildUI() {
		childEditorRootDiv.innerHTML = "";

		for (var i = 0; i < childEditors.length; i++) {
			var editor = childEditors[i];
			childEditorRootDiv.appendChild(editor.GetElement());

			if (i < childEditors.length - 1) {
				var arrowHolder = document.createElement("div");
				arrowHolder.style.textAlign = "center";
				childEditorRootDiv.appendChild(arrowHolder);

				var svgArrow = document.createElement("img");
				svgArrow.src = "image/down_arrow.svg";
				svgArrow.style.margin = "5px";
				svgArrow.style.width = "20px";
				arrowHolder.appendChild(svgArrow);
			}
		}
	}

	function UpdateNodeChildren() {
		var updatedChildren = [];

		for (var i = 0; i < childEditors.length; i++) {
			var editor = childEditors[i];
			updatedChildren = updatedChildren.concat(editor.GetNodes());
		}

		blockNode.SetChildren(updatedChildren);
	}

	this.GetNodes = function() {
		return [blockNode];
	}

	this.Serialize = function() {
		return blockNode.Serialize();
	}

	this.RemoveChild = function(childEditor) {
		childEditors.splice(childEditors.indexOf(childEditor),1);
		RefreshChildUI();

		UpdateNodeChildren();

		parentEditor.NotifyUpdate();
	}

	this.IndexOfChild = function(childEditor) {
		return childEditors.indexOf(childEditor);
	}

	this.InsertChild = function(childEditor, index) {
		childEditors.splice(index, 0, childEditor);
		RefreshChildUI();

		UpdateNodeChildren();

		parentEditor.NotifyUpdate();
	}

	this.AppendChild = function(childEditor) {
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
}

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
		"flow",
		localization.GetStringOrFallback("dialog_action_category_list", "lists")));
	div.appendChild(makeActionCategoryButton(
		"exit",
		localization.GetStringOrFallback("dialog_action_category_exit", "exit and ending actions")));
	div.appendChild(makeActionCategoryButton(
		"item",
		localization.GetStringOrFallback("dialog_action_category_item", "item and variable actions")));

	function makeActionBuilderButton(categoryName, text, createEditorFunc) {
		var actionBuilderButton = document.createElement("button");
		actionBuilderButton.classList.add("actionBuilderButton");
		actionBuilderButton.classList.add("actionBuilderButton_" + categoryName);
		actionBuilderButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " " + text;
		actionBuilderButton.onclick = function() {
			var editor = createEditorFunc();
			parentEditor.AppendChild(editor);
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
				var printFunc = scriptUtils.CreateEmptyPrintFunc();

				// hacky access of the parent node is required
				// because the print function needs to start with a parent
				// otherwise the dialog editor can't serialize the text D:
				parentEditor.GetNodes()[0].AddChild(printFunc);

				var editor = new DialogTextEditor([printFunc], parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"dialog",
			localization.GetStringOrFallback("function_pg_name", "pagebreak"),
			function() {
				var node = scriptUtils.CreateFunctionBlock("pg", []);
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"flow",
			localization.GetStringOrFallback("sequence_list_name", "sequence list"),
			function() {
				var node = scriptUtils.CreateSequenceBlock();
				var editor = new SequenceEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"flow",
			localization.GetStringOrFallback("cycle_list_name", "cycle list"),
			function() {
				var node = scriptUtils.CreateCycleBlock();
				var editor = new SequenceEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"flow",
			localization.GetStringOrFallback("shuffle_list_name", "shuffle list"),
			function() {
				var node = scriptUtils.CreateShuffleBlock();
				var editor = new SequenceEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"flow",
			localization.GetStringOrFallback("branching_list_name", "branching list"),
			function() {
				var node = scriptUtils.CreateIfBlock();
				var editor = new ConditionalEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"exit",
			localization.GetStringOrFallback("function_exit_name", "exit"),
			function() {
				var node = scriptUtils.CreateFunctionBlock("exit", ["0", 0, 0]);
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"exit",
			localization.GetStringOrFallback("function_end_name", "end"),
			function() {
				var node = scriptUtils.CreateFunctionBlock("end", []);
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"exit",
			localization.GetStringOrFallback("dialog_action_locked_set", "lock / unlock"),
			function() {
				var node = scriptUtils.CreatePropertyNode("locked", true);
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_item_set", "set item count"),
			function() {
				var node = scriptUtils.CreateFunctionBlock("item", ["0", 10]);
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_item_increase", "increase item count"),
			function() {
				var expressionNode = scriptInterpreter.CreateExpression('{item "0"} + 1');
				var codeBlock = scriptUtils.CreateCodeBlock();
				codeBlock.children.push(expressionNode);
				var node = scriptUtils.CreateFunctionBlock("item", ["0"]);
				node.children[0].args.push(codeBlock); // hacky
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_item_decrease", "decrease item count"),
			function() {
				var expressionNode = scriptInterpreter.CreateExpression('{item "0"} - 1');
				var codeBlock = scriptUtils.CreateCodeBlock();
				codeBlock.children.push(expressionNode);
				var node = scriptUtils.CreateFunctionBlock("item", ["0"]);
				node.children[0].args.push(codeBlock); // hacky
				var editor = new FunctionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_variable_set", "set variable value"),
			function() {
				var expressionNode = scriptInterpreter.CreateExpression("a = 5");
				var node = scriptUtils.CreateCodeBlock();
				node.children.push(expressionNode);
				var editor = new MathExpressionEditor(node, parentEditor);
				return editor;
			}));

	div.appendChild(
		makeActionBuilderButton(
			"item",
			localization.GetStringOrFallback("dialog_action_variable_change", "change variable value"),
			function() {
				var expressionNode = scriptInterpreter.CreateExpression("a = a + 1");
				var node = scriptUtils.CreateCodeBlock();
				node.children.push(expressionNode);
				var editor = new MathExpressionEditor(node, parentEditor);
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