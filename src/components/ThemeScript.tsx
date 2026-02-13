export default function ThemeScript() {
    const code = `
        (function () {
            try {
            var t = localStorage.getItem("theme");
            if (t !== "light" && t !== "dark") t = "dark";
            document.documentElement.dataset.theme = t;
            } catch (e) {}
        })();
        `;
    return <script dangerouslySetInnerHTML={{ __html: code }} />;
}