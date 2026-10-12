import Link from "next/link";
import Media from "./Media";
import { LOGO, SITE_NAME } from "@/data/site";

/** Logo + site name, used in the navbar and footer. */
export default function Brand() {
  return (
    <Link href="/#home" className="brand" aria-label={`${SITE_NAME} home`}>
      <Media src={LOGO} alt="Site logo" label="Logo" className="brand__logo media--logo" sizes="72px" />
      <span className="brand__name">{SITE_NAME}</span>
    </Link>
  );
}
