export type TServerActionResponse<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string; status: number };

export const unwrap = <T>(result: TServerActionResponse<T>): T => {
  if (!result.success) throw new Error(result.error);
  return (result as { success: true; data: T }).data;
};
