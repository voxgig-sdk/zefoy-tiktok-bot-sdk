# frozen_string_literal: true

# Typed models for the ZefoyTiktokBot SDK.
#
# GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Member types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Ruby types are unenforced; these YARD
# annotations document the shapes. Do not edit by hand.

# Engagement entity data model.
#
# @!attribute [rw] amount
#   @return [Integer, nil]
#
# @!attribute [rw] estimated_time
#   @return [Integer, nil]
#
# @!attribute [rw] message
#   @return [String, nil]
#
# @!attribute [rw] status
#   @return [String, nil]
#
# @!attribute [rw] success
#   @return [Boolean, nil]
#
# @!attribute [rw] type
#   @return [String, nil]
#
# @!attribute [rw] url
#   @return [String]
Engagement = Struct.new(
  :amount,
  :estimated_time,
  :message,
  :status,
  :success,
  :type,
  :url,
  keyword_init: true
)

# Match filter for Engagement#create (any subset of Engagement fields).
#
# @!attribute [rw] amount
#   @return [Integer, nil]
#
# @!attribute [rw] estimated_time
#   @return [Integer, nil]
#
# @!attribute [rw] message
#   @return [String, nil]
#
# @!attribute [rw] status
#   @return [String, nil]
#
# @!attribute [rw] success
#   @return [Boolean, nil]
#
# @!attribute [rw] type
#   @return [String, nil]
#
# @!attribute [rw] url
#   @return [String, nil]
EngagementCreateData = Struct.new(
  :amount,
  :estimated_time,
  :message,
  :status,
  :success,
  :type,
  :url,
  keyword_init: true
)

