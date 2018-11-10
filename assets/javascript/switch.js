// Confirm cookie value on load
window.onload = function() {
  var cookieNightModeArray = document.cookie.split(';').filter((item) => item.includes('night='));

  if (cookieNightModeArray.length !== 0 && cookieNightModeArray[0].includes('true')) {
    document.querySelector('input[type="checkbox"]').checked = true;

    toggleColorToDark();
  };
};

// Toggle colormode
document.addEventListener('DOMContentLoaded', function () {
  var checkbox = document.querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', function () {
    if (checkbox.checked) {
      console.log('Checked');

      document.cookie = "night=true; path=/";

      toggleColorToDark();
    } else {
      console.log('Not checked');

      document.cookie = "night=false; path=/";

      toggleColorToLight();
    }
  });
});

function toggleColorToDark() {
  console.log('Set all colors to dark');

  toggleElementColorToDark(document.body);
};

function toggleColorToLight() {
  console.log('Set all colors to light');

  toggleElementColorToLight(document.body);
};

function toggleElementColorToDark(element) {
  element.className += " dark";
};

function toggleElementColorToLight(element) {
  element.className -= " dark";
};
