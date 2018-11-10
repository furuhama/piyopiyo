// Confirm cookie value on load
window.onload = function() {
  var cookieDarkModeArray = document.cookie.split(';').filter((item) => item.includes('dark='));

  // if cookie `dark` is set to `true`, initialize pages with dark mode
  if (cookieDarkModeArray.length !== 0 && cookieDarkModeArray[0].includes('true')) {
    document.querySelector('input[type="checkbox"]').checked = true;

    toggleColorToDark();
  };
};

// Toggle colormode when checkbox is toggled
document.addEventListener('DOMContentLoaded', () => {
  var checkbox = document.querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      console.log('Checked');

      document.cookie = "dark=true; path=/";

      toggleColorToDark();
    } else {
      console.log('Not checked');

      document.cookie = "dark=false; path=/";

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
  element.className = "dark";
};

toggleElementColorToLight = (element) => {
  element.className = "";
};
