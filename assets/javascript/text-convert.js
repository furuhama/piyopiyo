const plainText = document.getElementById("text-escape-base64-text");
const utf8Text = document.getElementById("text-escape-utf8-text");

const updatePlainText = (value) => {
  const result = decodeURIComponent(escape(atob(value)));
  utf8Text.value = result;
}
