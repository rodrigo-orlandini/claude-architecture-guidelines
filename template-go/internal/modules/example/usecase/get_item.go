package usecase

import (
	"context"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/platform/observability"
)

type GetItemUseCase struct {
	Items ItemRepository
}

func NewGetItemUseCase(items ItemRepository) *GetItemUseCase {
	return &GetItemUseCase{Items: items}
}

func (uc *GetItemUseCase) Execute(ctx context.Context, id string) (domain.Item, error) {
	ctx, span := observability.Tracer("example").Start(ctx, "example.get-item")
	defer span.End()

	item, err := uc.Items.FindByID(ctx, id)
	if err != nil {
		return domain.Item{}, err
	}
	if item == nil {
		domainErr := domain.NewItemNotFoundError(id)
		observability.Metrics.ItemLookupFailed.WithLabelValues("ITEM_NOT_FOUND").Inc()
		observability.FromContext(ctx).WarnContext(ctx, "item not found", "itemId", id)
		return domain.Item{}, domainErr
	}

	return *item, nil
}
