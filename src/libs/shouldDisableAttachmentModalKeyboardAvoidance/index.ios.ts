/**
 * On iOS the attachment screen's keyboard avoidance resizes the pager when rotation hides the keyboard,
 * and the pager then reports page 0. Avoidance moves onto the password form instead.
 */
const shouldDisableAttachmentModalKeyboardAvoidance = true;

export default shouldDisableAttachmentModalKeyboardAvoidance;
