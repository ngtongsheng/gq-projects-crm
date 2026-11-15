import type { TaskCategory, TaskStatus } from "./task-flow";

// The demo's words (TK_ST, TK_CAT).
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_review: "Pending Review",
  revision_required: "Revision Required",
  completed: "Completed",
};

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  customer_appointment: "Customer appointment",
  follow_up_customer: "Follow up customer",
  design: "Design",
  e_catalogue: "E-catalogue",
  sample_folder: "Sample folder",
  website_upload: "Website upload",
  new_product: "New product",
  product_launch: "Product launch",
  training_material: "Training material",
  marketing_material: "Marketing material",
  other: "Other",
};
