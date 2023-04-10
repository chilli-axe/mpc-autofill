// unfortunately, for static deployment, we need to specify our Bootswatch theme font here again :/
// google font config retrieved from https://github.com/thomaspark/bootswatch/blob/v5/dist/superhero/_bootswatch.scss
import { Lato } from "next/font/google";

export const lato = Lato({
  weight: ["300", "400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
