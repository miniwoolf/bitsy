function TitleControl() {
	var isMultiline = false;

	// is it bad to share the id counter with the other editors?
	var editorId = dialogScriptEditorUniqueIdCounter;
	dialogScriptEditorUniqueIdCounter++;

	var div = document.createElement("div");
	div.classList.add("titleWidget");

	var titleTextInput = document.createElement("input");
	titleTextInput.classList.add("textInputField");
	titleTextInput.type = "text";
	titleTextInput.placeholder = localization.GetStringOrFallback("title_placeholder", "Title");
	div.appendChild(titleTextInput);

	var openButton = document.createElement("button");
	openButton.classList.add("titleOpenDialog");
	openButton.title = "open title in dialog editor"; // todo : localize
	openButton.appendChild(iconUtils.CreateIcon("open_tool"));
	openButton.onclick = function() {
		events.Raise("select_dialog", { id: titleId });
	}
	div.appendChild(openButton);

	function updateWidgetContent() {
		var titleLines = getTitle().split("\n");
		isMultiline = titleLines.length > 1;
		titleTextInput.value = (isMultiline ? titleLines[1] + "..." : titleLines[0]);
		titleTextInput.readOnly = isMultiline;
		openButton.style.display = isMultiline ? "flex" : "none";
	}

	titleTextInput.onchange = function() {
		setTitle(titleTextInput.value);
		refreshGameData();
		events.Raise("dialog_update", { dialogId:titleId, editorId:editorId });
	}

	titleTextInput.onfocus = function() {
		if (!isMultiline) {
			openButton.style.display = "flex";
		}
	}

	titleTextInput.onblur = function() {
		if (!isMultiline) {
			setTimeout(function() {
				openButton.style.display = "none";
			}, 300); // the timeout is a hack to allow clicking the open button
		}
	}

	events.Listen("dialog_update", function(event) {
		if (event.dialogId === titleId && event.editorId != editorId) {
			updateWidgetContent();
		}
	});

	events.Listen("game_data_change", function(event) {
		updateWidgetContent(); // TODO : only do this if the text actually changes?
	});

	updateWidgetContent();

	this.GetElement = function() {
		return div;
	}
}