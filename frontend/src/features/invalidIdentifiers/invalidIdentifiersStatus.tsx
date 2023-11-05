import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { selectInvalidIdentifiersCount } from "@/features/invalidIdentifiers/invalidIdentifiersSlice";
import { showModal } from "@/features/modals/modalsSlice";
export function InvalidIdentifiersStatus() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const invalidIdentifierCount = useAppSelector(selectInvalidIdentifiersCount);

  //# endregion

  //# region callbacks

  const handleClick = () => dispatch(showModal("invalidIdentifiers"));

  //# endregion

  return invalidIdentifierCount > 0 ? (
    <Alert variant="primary">
      <p>
        Your project specified <b>{invalidIdentifierCount}</b> card version
        {invalidIdentifierCount != 1 ? "s" : ""} which couldn&apos;t be found.
      </p>
      <div className="d-grid gap-0">
        <Button variant="warning" onClick={handleClick}>
          Review Invalid Cards
        </Button>
      </div>
    </Alert>
  ) : (
    <></>
  );
}
