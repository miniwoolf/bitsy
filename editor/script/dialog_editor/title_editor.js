/* TitleWidget TODO
- gameTextDir class
- empty title mode
- get rid of the duplicate preview and text input and just make the input readonly
- rename?
*/
function TitleWidget() {
	var isMultiline = false;

	// is it bad to share the id counter with the other editors?
	var editorId = dialogScriptEditorUniqueIdCounter;
	dialogScriptEditorUniqueIdCounter++;

	var div = document.createElement("div");
	div.classList.add("titleWidget");

	var titleTextInput = document.createElement("input");
	titleTextInput.classList.add("textInputField");
	titleTextInput.type = "string";
	titleTextInput.placeholder = localization.GetStringOrFallback("title_placeholder", "Title");
	div.appendChild(titleTextInput);

	var openButton = document.createElement("button");
	openButton.classList.add("titleOpenDialog");
	openButton.title = "open title in dialog editor"; // todo : localize
	openButton.appendChild(iconUtils.CreateIcon("open_tool"));
	openButton.onclick = function() {
		events.Raise("select_dialog", { id: titleDialogId });
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
		events.Raise("dialog_update", { dialogId:titleDialogId, editorId:editorId });
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
		if (event.dialogId === titleDialogId && event.editorId != editorId) {
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