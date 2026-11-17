import { CanDeactivateFn } from '@angular/router';

export interface CanConfirmUnsavedChanges {
  confirmCanDeactivate(): boolean | Promise<boolean>;
}

export const canDeactivateUnsavedChanges: CanDeactivateFn<CanConfirmUnsavedChanges> = component =>
  component.confirmCanDeactivate();
