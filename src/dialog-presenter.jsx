import React, { useSyncExternalStore } from "react";
import { AppDialog } from "./components";

export const DialogPresenter = React.memo(function DialogPresenter({ controller }) {
  const dialog = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <AppDialog dialog={dialog} onClose={controller.close} />;
});
