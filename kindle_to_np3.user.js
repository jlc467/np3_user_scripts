// ==UserScript==
// @name        Kindle Noteplan3 X-Callbacks
// @namespace   Violentmonkey Scripts
// @match *://read.amazon.com/*
// @grant       none
// @version     1.0
// @author      -
// @description Adds links for creating notes with highlights automatically
// ==/UserScript==

// Credit to these scripts that helped build this:
// https://github.com/yanncharlou/GreaseMonkeyKindleNotesExtractor
// https://github.com/serizawa-jp/roamkit/blob/b3edbbd8aa5fda53abb25e9a32f87dec676ffdf9/bookmarklets/kindle2roam/kindle2roam.js

(function () {
  var currentTitle;
  var allAnnotationMD = "";

  function startScript() {
    setInterval(detectChange, 1000);
  }

  // used to detect if user has navigated to new book
  function detectChange() {
    try {
      let newTitle = getTitle();
      if (!newTitle) {
        //console.log("empty new title");
        return;
      }
      if (!getAnnotationsElementArray().length) {
        //console.log("empty annotations");
        return;
      }
      if (newTitle !== currentTitle) {
        currentTitle = newTitle;
        //console.log("title changed!");
        cleanup();
        addActions();
      }
    } catch (err) {
      //console.log("detectChange ~ err", err);
    }
  }

  // adds x-callback anchor tags to title of book and individual annotations
  function addActions() {
    var authors = getAuthors();

    getAnnotationsElementArray().forEach((a) => {
      try {
        var annotationMD = "";

        const annotationElement = getAnnotationElement(a);

        if (!annotationElement) {
          // haven't seen this yet but guess it can happen
          return;
        }

        var highlightText = getHighlightText(a);
        var noteText = getNoteText(a);
        let location = getLocation(a);
        var link = getMDLinkToNote(a);

        if (noteText) {
          annotationMD += "\n- " + noteText;
          if (link) {
            annotationMD += link;
          }
        }
        if (highlightText) {
          annotationMD += "\n> " + highlightText.replace("\n", "\n> ");
          if (link) {
            annotationMD += link;
          }
        }

        allAnnotationMD += annotationMD + "\n";

        appendPipeSeperator(annotationElement);

        annotationElement.appendChild(
          getAddSingleHighlightLink(
            annotationMD,
            `${currentTitle}${location ? ` location ${location}` :''}`,
            authors
          )
        );

        appendPipeSeperator(annotationElement);

        annotationElement.appendChild(
          getAddToExistingLink(annotationMD, currentTitle)
        );

        appendPipeSeperator(annotationElement);

        annotationElement.appendChild(getClipboardLink(annotationMD));
      } catch (err) {
        //console.log("getAnnotationsElementArray forEach ~ err", err);
      }
    });

    addTitleLinks(allAnnotationMD, authors);
  }

  // begin np3 x-callback-url code

  // creates new note
  function getAddSingleHighlightLink(text, title, authors) {
    var a = document.createElement("a");
    var linkText = document.createTextNode("new");
    var textWithAuthor = `Author(s): ${authors}\n${text}`;
    a.appendChild(linkText);
    a.className = "a-size-small a-color-secondary np3";
    a.title =
      "Create note with this highlight in NP3. Title of note will be the title of book.";
    a.href = `noteplan://x-callback-url/addNote?noteTitle=${encodeURIComponent(
      title
    )}&openNote=yes&text=${encodeURIComponent(textWithAuthor)}`;
    return a;
  }

  // appends to existing note
  function getAddToExistingLink(text, title) {
    var a = document.createElement("a");
    var linkText = document.createTextNode("append");
    a.appendChild(linkText);
    a.className = "a-size-small a-color-secondary np3";
    a.title =
      "Add to existing note in NP3, assuming note title is the title of book.";
    a.href = `noteplan://x-callback-url/addText?noteTitle=${encodeURIComponent(
      title
    )}&text=${text}&mode=append`;
    return a;
  }

  // end np3 x-callback-url code

  // copies to clipboard
  function getClipboardLink(text) {
    var a = document.createElement("a");
    var linkText = document.createTextNode("copy");
    a.appendChild(linkText);
    a.className = "a-size-small a-color-secondary np3";
    a.title = "Copy to clipboard for NP3";
    a.href = "javascript:void(0);";
    a.addEventListener("click", () => {
      copyToClipboard(text);
    });
    return a;
  }

  // adds links near title of book, uses all annotations for book
  function addTitleLinks(allAnnotationMD, authors) {
    const authorsElement = getAuthorsElement();
    var topLevelLinkContainerElement = document.createElement("div");
    topLevelLinkContainerElement.appendChild(
      getAddSingleHighlightLink(allAnnotationMD, currentTitle, authors)
    );
    appendPipeSeperator(topLevelLinkContainerElement);
    topLevelLinkContainerElement.appendChild(getClipboardLink(allAnnotationMD));
    authorsElement.parentNode.insertBefore(
      topLevelLinkContainerElement,
      authorsElement.nextSibling
    );
  }

  function getMDLinkToNote(note) {
    try {
      let url = getDirectUrlToNote(note);
      let loc = getLocation(note);

      if (url && loc) {
        return " [loc " + loc + "](" + url + ")";
      }
      return "";
    } catch (err) {}
  }

  function getDirectUrlToNote(note) {
    try {
      let location = getLocation(note);
      let asin = getBookASIN();
      return "kindle://book?action=open&asin=" + asin + "&location=" + location;
    } catch (err) {}
  }

  function getAuthors() {
    const authors = getAuthorsElement()
      .textContent.split("、")
      .map((a) => `[[${a}]]`)
      .join(" ");

    return authors;
  }

  function getTitle() {
    const title = getTitleElement().textContent;
    return title;
  }

  // start element / text getters, liable to change

  function getLocation(note) {
    try {
      var node = note.querySelector("#annotationHighlightHeader");
      if (node) {
        var loc = /Location:\s*([\d,]*)/g.exec(node.textContent);
        if (loc.length > 0) {
          return loc[1].replace(",", "");
        }
      }

      return "";
    } catch (err) {}
  }

  function getBookASIN() {
    let asinInput = document.getElementById("kp-notebook-annotations-asin");
    if (asinInput) {
      return asinInput.value;
    }
    return false;
  }

  function getTitleElement() {
    return document.querySelector("#annotation-section h3");
  }

  function getAuthorsElement() {
    const titleElement = getTitleElement();
    const authorsElement = titleElement.nextElementSibling;
    return authorsElement;
  }

  function getAnnotationsElementArray() {
    return [
      ...document
        .getElementById("kp-notebook-annotations")
        .getElementsByClassName("kp-notebook-row-separator"),
    ];
  }

  function getHighlightText(note) {
    var node = note.querySelector("#highlight");

    if (node) {
      return node.textContent;
    }
    return "";
  }

  function getNoteText(note) {
    var node = note.querySelector("#note");
    if (node) {
      return node.textContent;
    }
    return "";
  }

  function getAnnotationElement(a) {
    return (
      a.querySelector("#annotationHighlightHeader") ||
      a.querySelector("#annotationNoteHeader")
    );
  }

  // end element / text getters

  function cleanup() {
    // remove elements with np3 class.. seems like they get destroyed by themselves, not necessary.
    allAnnotationMD = "";
  }

  function appendPipeSeperator(ele) {
    ele.appendChild(document.createTextNode(" | "));
  }

  async function copyToClipboard(textToCopy) {
    try {
      // 1) Copy text
      await navigator.clipboard.writeText(textToCopy);

      // 2) Catch errors
    } catch (err) {
      //console.error("Failed to copy: ", err);
    }
  }

  setTimeout(() => {
    startScript();
  }, 500);
})();