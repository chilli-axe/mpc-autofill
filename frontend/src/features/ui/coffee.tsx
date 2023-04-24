import Image from "next/image";
import React from "react";

export function Coffee() {
  return (
    <a href="https://www.buymeacoffee.com/chilli.axe" target="_blank">
      <Image
        className="mx-auto d-block"
        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
        alt="Buy Me A Coffee"
        width={217}
        height={60}
      />
    </a>
  );
}
