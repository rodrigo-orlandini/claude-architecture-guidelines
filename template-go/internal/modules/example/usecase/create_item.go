package usecase

import (
	"context"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/platform/observability"
)

type CreateItemInput struct {
	Name string
}

// CreateItemUseCase mirrors the TS kit's writing pattern: validate value
// objects, build the entity, persist through the port, log/measure.
type CreateItemUseCase struct {
	Items ItemRepository
}

func NewCreateItemUseCase(items ItemRepository) *CreateItemUseCase {
	return &CreateItemUseCase{Items: items}
}

func (uc *CreateItemUseCase) Execute(ctx context.Context, input CreateItemInput) (domain.Item, error) {
	ctx, span := observability.Tracer("example").Start(ctx, "example.create-item")
	defer span.End()

	name, err := domain.NewItemName(input.Name)
	if err != nil {
		return domain.Item{}, err
	}

	item := domain.NewItem(name)
	if err := uc.Items.Save(ctx, item); err != nil {
		return domain.Item{}, err
	}

	observability.AddFields(ctx, map[string]string{"itemId": item.ID()})
	observability.Metrics.ItemsCreated.Inc()
	observability.FromContext(ctx).InfoContext(ctx, "item created")

	return item, nil
}
