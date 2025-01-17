document.getElementById("redirect-button").addEventListener("click", () => {
    const encodedURL = "${btoa(targetURL)}"; // Сохранённая в шаблоне переменная
    const url = atob(encodedURL);
    window.location.href = url;
});
