// Confirm cookie value on load
window.onload = function() {
  var cookieNightModeArray = document.cookie.split(';').filter((item) => item.includes('night='));

  if (cookieNightModeArray.length !== 0 && cookieNightModeArray[0].includes('true')) {
    document.querySelector('input[type="checkbox"]').checked = true;

    toggleColorToDark();
  };
};

// Toggle colormode
document.addEventListener('DOMContentLoaded', () => {
  var checkbox = document.querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', () => {
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

toggleColorToDark = () => {
  console.log('Set all colors to dark');

  toggleElementColorToDark(document.body);
};

toggleColorToLight = () => {
  console.log('Set all colors to light');

  toggleElementColorToLight(document.body);
};

toggleElementColorToDark = (element) => {
  element.className += " dark";
};

toggleElementColorToLight = (element) => {
  element.className -= " dark";
};
