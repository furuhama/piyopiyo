document.addEventListener('DOMContentLoaded', function () {
  var checkbox = document.querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', function () {
    if (checkbox.checked) {
      console.log('Checked');
      toggleColorToLight(document.body);
    } else {
      console.log('Not checked');
      toggleColorToDark(document.body);
    }
  });
});

function toggleColorToLight(element) {
  element.className += " dark";
};

function toggleColorToDark(element) {
  element.className -= " dark";
};
